# LinkedIn Profile Field Map

25+ editable fields across all profile sections, mapped by edit page.

## Intro Page

`/in/{vanity}/edit/intro`

| # | Field | Tag | Label | Notes |
|---|-------|-----|-------|-------|
| 0 | `first_name` | INPUT | First name* | |
| 1 | `last_name` | INPUT | Last name* | |
| 2 | `additional_name` | INPUT | Additional name | Middle name / maiden name |
| 3 | `pronouns` | SELECT | Pronouns | He/Him, She/Her, They/Them, etc. |
| 4 | `headline` | DIV | Headline | contenteditable — main subtitle under name |
| 5 | `position` | SELECT | Position* | Current job position |
| 6 | `industry` | INPUT | Industry* | Free-text industry |
| 7 | `school` | SELECT | School* | Education institution |
| 8 | `country` | INPUT | Country/Region* | |
| 9 | `city` | INPUT | City | |

## About Page

`/in/{vanity}/edit/forms/summary/new/`

| # | Field | Tag | Label | Notes |
|---|-------|-----|-------|-------|
| 0 | `about` | DIV | About | contenteditable — main summary section |

## Experience (Add New)

`/in/{vanity}/edit/forms/position/new/`

| # | Field | Tag | Label | Notes |
|---|-------|-----|-------|-------|
| 0 | `title` | INPUT | Title | Job title |
| 1 | `employment_type` | SELECT | Employment type | Full-time, Part-time, Self-employed, etc. |
| 2 | `company` | INPUT | Company | Company name |
| 3 | `start_month` | SELECT | Start month | Month dropdown |
| 4 | `start_year` | SELECT | Start year* | Year dropdown |
| 5 | `end_month` | SELECT | End month | Leave empty for current position |
| 6 | `end_year` | SELECT | End year | Leave empty for current position |
| 7 | `location` | INPUT | Location | City, Country |
| 8 | `location_type` | SELECT | Location type | On-site, Hybrid, Remote |
| 9 | `description` | DIV | Description | contenteditable — job description |

## Education (Add New)

`/in/{vanity}/edit/forms/education/new/`

| # | Field | Tag | Label | Notes |
|---|-------|-----|-------|-------|
| 0 | `school` | INPUT | School* | Institution name |
| 1 | `degree` | INPUT | Degree | BSc, MSc, PhD, etc. |
| 2 | `field_of_study` | INPUT | Field of study | Computer Science, etc. |
| 3 | `start_month` | SELECT | Start month | |
| 4 | `start_year` | SELECT | Start year | |
| 5 | `end_month` | SELECT | End month | |
| 6 | `end_year` | SELECT | End year | |
| 7 | `grade` | INPUT | Grade | GPA or classification |
| 8 | `activities` | TEXTAREA | Activities | Extracurricular involvement |
| 9 | `description` | TEXTAREA | Description | Additional details |

## Projects (Add New)

`/in/{vanity}/edit/forms/project/new/`

| # | Field | Tag | Label | Notes |
|---|-------|-----|-------|-------|
| 0 | `project_name` | INPUT | Project name* | |
| 1 | `description` | TEXTAREA | Description | |
| 2 | `start_month` | SELECT | Start month | |
| 3 | `start_year` | SELECT | Start year | |
| 4 | `end_month` | SELECT | End month | |
| 5 | `end_year` | SELECT | End year | |
| 6 | `currently_working` | CHECKBOX | I am currently working on this project | |
| 7 | `project_url` | INPUT | Project URL | Link to repo, site, or demo |
| 8 | `associated_with` | INPUT | Associated with | Organization or company |
| 9 | `contributors` | INPUT | Contributors | Collaborator names |
| 10 | `skills_used` | INPUT | Skills used | Comma-separated skills |

## Other Pages

Additional achievement pages follow the same URL pattern:

`/in/{vanity}/edit/forms/achievement/{type}/new/`

Supported types: `project`, `publication`, `patent`, `course`, `test_score`, `language`, `organisation`, `honor_award`.

## Notes

- Fields marked with `*` are required by LinkedIn
- `contenteditable` DIV fields are rich text — text input works but formatting is not preserved
- SELECT fields use label matching (e.g. `selectOption("January")`)
- CHECKBOX fields accept `true`/`false` or boolean values
- LinkedIn's React forms may keep the Submit button disabled until specific fields and their dependencies are filled (e.g., a project entry often requires at minimum: project name, association, and one skill before the button enables)
- The field index (`idx`) corresponds to the nth visible input on the page and may shift if LinkedIn updates their form layout
