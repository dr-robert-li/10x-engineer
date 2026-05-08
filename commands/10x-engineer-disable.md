---
description: Disengage the 10x-engineer methodology
---

Disengage the 10x-engineer methodology for the remainder of this session and any future session that reads the runtime state.

To do so, write the following content to `~/.10x-engineer/state.json` (creating the parent directory if it does not exist), then confirm to the user that the methodology is disengaged:

```json
{
  "enabled": false
}
```

After writing, respond in normal, direct prose with no philosophical preamble, no first-principles reimplementation, no compiler-driven detours — for this turn and every subsequent turn until the state file is restored to `enabled: true` or removed. The methodology is dormant; ordinary engineering practice resumes.
