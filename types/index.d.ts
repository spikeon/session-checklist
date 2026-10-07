export type ChecklistItem = {
  id: number
  text: string
  isDone: boolean
  /** True while the model splits the prompt into tasks. */
  isPending?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'session-checklist': { items: ChecklistItem[]; isAuto: boolean }
  }
}
