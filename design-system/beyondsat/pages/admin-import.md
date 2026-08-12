# Admin Add tests — page overrides

Overrides `MASTER.md` for `/admin/import` (nav label: **Add tests**).

## Flow

Wizard, not tabs:

1. **Setup** — name, date, section, module, difficulty, default skill, create-set toggle  
2. **Source** — paper | spreadsheet | JSON cards  
3. **Extract** — upload / paste / Gemini vision (2-stage)  
4. **Answers** — answer key for paper drafts  
5. **Review** — validate, Fix broken with AI (2-stage), import  

## Patterns

- Shared `WizardSteps` chrome with unlock rules  
- Extracted panels under `src/components/admin-import/`  
- Editors can open **Tests** after creating a set  
- Confirm before switching source when work would be lost  
