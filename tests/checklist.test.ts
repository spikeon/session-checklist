import { test, expect, mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const USER = { kind: 'composer' } as const
const TOOL = 'mcp__session-checklist__mark_request'
const PANE = {
  component: 'Pane',
  requestId: 'session-checklist',
  props: { bodyColumns: 40 } as never,
} as const

test('a typed prompt becomes an item, and the tool marks it done', async ($, on) => {
  let context: readonly string[] = []
  on('prompt.submit', async (_$, e) => {
    context = e.context ?? []
    return { text: e.text, context: e.context }
  })

  await $.prompt.submit({ text: 'Fix the  login\nbug', wait: false, origin: USER })
  expect(context.join('\n')).toContain('#1 [ ] Fix the login bug')

  await $.prompt.submit({ text: '/help', wait: false, origin: USER })
  await $.prompt.submit({ text: 'Background task done', wait: false, origin: { kind: 'task-notification' } as never })
  await $.prompt.submit({ text: 'Add a test', wait: false, origin: USER })
  expect(context.join('\n')).toContain('#2 [ ] Add a test')

  const marked = await $.tool.call({ tool: TOOL, id: 1, done: true })
  expect(marked.result).toBe('Request #1 is marked done.')
  const missing = await $.tool.call({ tool: TOOL, id: 9, done: true })
  expect(missing.isError).toBe(true)

  await $.prompt.submit({ text: 'Next', wait: false, origin: USER })
  expect(context.join('\n')).toContain('#1 [x] Fix the login bug')
})

test('the pane lists items and a press toggles one', async ($, on) => {
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-checklist', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /No requests yet/ })).toBeDefined()
    await ui.unmount()
  }
  await $.prompt.submit({ text: 'Write docs', wait: false, origin: USER })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-checklist', surface, ...PANE })
    expect(await ui.find({ type: 'Button', text: /Write docs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^0\/1$/ })).toBeDefined()
    await ui.press({ key: 'toggle-1' })
    expect(await ui.find({ type: 'Text', text: /^1\/1$/ })).toBeDefined()
    await ui.press({ key: 'toggle-1' })
    await ui.unmount()
  }
})

const run = ($: Engine, command: string, args: string) =>
  $.command.run({ command, args, origin: USER, presentation: { isFullscreen: true, columns: 80 } } as never)

test('the manual commands add, check, and turn auto off', async ($, on) => {
  let context: readonly string[] = []
  on('prompt.submit', async (_$, e) => {
    context = e.context ?? []
    return { text: e.text, context: e.context }
  })

  expect((await run($, 'checklist-item', '')).text).toContain('Usage')
  expect((await run($, 'checklist-item', 'Write the  release notes')).text).toBe(
    'Added #1: Write the release notes',
  )
  await run($, 'checklist-item', 'Write the tests')

  expect((await run($, 'check', 'write')).text).toContain('More than one item')
  expect((await run($, 'check', 'nothing')).text).toContain('No open item')
  expect((await run($, 'check', 'release')).text).toBe('Checked #1: Write the release notes')
  expect((await run($, 'check', '#2')).text).toBe('Checked #2: Write the tests')

  expect((await run($, 'uncheck', '')).text).toContain('Usage: /uncheck')
  expect((await run($, 'uncheck', 'write')).text).toContain('More than one item')
  expect((await run($, 'uncheck', 'release')).text).toBe('Unchecked #1: Write the release notes')
  expect((await run($, 'uncheck', 'release')).text).toContain('No checked item')
  expect((await run($, 'check', '1')).text).toBe('Checked #1: Write the release notes')

  expect((await run($, 'checklist-auto', 'maybe')).text).toContain('Usage')
  expect((await run($, 'checklist-auto', 'off')).text).toBe('Automatic checklist items are off.')
  expect((await run($, 'checklist-auto', '')).text).toBe('Automatic checklist items are off.')
  await $.prompt.submit({ text: 'Do not add me', wait: false, origin: USER })
  expect(context.join('\n')).not.toContain('Do not add me')
  expect(context.join('\n')).toContain('#2 [x] Write the tests')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-checklist', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /Automatic items are off/ })).toBeDefined()
    await ui.unmount()
  }

  await run($, 'checklist-auto', 'on')
  await $.prompt.submit({ text: 'Add me', wait: false, origin: USER })
  expect(context.join('\n')).toContain('#3 [ ] Add me')
})

const LIST = 'mcp__session-checklist__list_requests'

test('a prompt is split into short tasks in the background', async ($, on) => {
  const clock = mock.clock(on)
  let asked = ''
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))
  on('model.complete', async (_$, e) => {
    asked = e.prompt
    const text = asked.includes('thanks')
      ? '{"tasks": []}'
      : asked.includes('chat')
        ? 'Sure! I can help with that.'
        : 'Here: {"tasks": ["Add /checklist-item [text]", "Add /checklist-auto [on|off]", "Add /check [item]"]}'
    return { value: { isAnswered: true, text, usage: {} } } as never
  })

  await $.prompt.submit({ text: 'Add these commands: ...', wait: false, origin: USER })
  expect((await $.tool.call({ tool: LIST })).result).toBe('#1 [ ] Add these commands: ...')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-checklist', surface, ...PANE })
    expect(await ui.find({ type: 'Button', text: /splitting/ })).toBeDefined()
    await ui.unmount()
  }

  await clock.advance(1)
  expect(asked).toBe('<message>\nAdd these commands: ...\n</message>')
  expect((await $.tool.call({ tool: LIST })).result).toBe(
    '#1 [ ] Add /checklist-item [text]\n#2 [ ] Add /checklist-auto [on|off]\n#3 [ ] Add /check [item]',
  )

  await $.prompt.submit({ text: 'thanks', wait: false, origin: USER })
  await clock.advance(1)
  expect((await $.tool.call({ tool: LIST })).result).not.toContain('thanks')

  await $.prompt.submit({ text: 'Let us chat', wait: false, origin: USER })
  await clock.advance(1)
  expect((await $.tool.call({ tool: LIST })).result).toContain('#4 [ ] Let us chat')
})

const REPLACE = 'mcp__session-checklist__replace_request'

test('the agent splits a group task into one task for each member', async ($, on) => {
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))
  await $.prompt.submit({ text: 'Fix the failing tests', wait: false, origin: USER })
  await $.prompt.submit({ text: 'Update the docs', wait: false, origin: USER })

  const split = await $.tool.call({ tool: REPLACE, id: 1, tasks: ['Fix test A', 'Fix test B'] })
  expect(split.result).toBe('#1 [ ] Fix test A\n#3 [ ] Fix test B\n#2 [ ] Update the docs')

  expect((await $.tool.call({ tool: REPLACE, id: 2, tasks: [] })).result).toBe('Request #2 is removed.')
  expect((await $.tool.call({ tool: REPLACE, id: 9, tasks: ['x'] })).isError).toBe(true)
  expect((await $.tool.call({ tool: LIST })).result).toBe('#1 [ ] Fix test A\n#3 [ ] Fix test B')
})
