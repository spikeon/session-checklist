# session-checklist

A Claude Code mod. It keeps a checklist of the requests in a session and shows the list in a sidebar pane.

![The checklist pane next to a session](docs/screenshot.png)

## Commands

- `/checklist`: open the pane.
- `/checklist-item [text]`: add an item.
- `/checklist-auto [on|off]`: turn automatic items on or off.
- `/check [item]`: mark an item as done.
- `/uncheck [item]`: mark an item as not done.

## Install

1. Clone this repository.
2. Start Claude Code with `claude --plugin-dir <path to session-checklist>`.

## Test

```bash
claude plugin test .
```
