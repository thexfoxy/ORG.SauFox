# Credits

`js/credits.js` defines 281 film, animation and game roles across 20 departments.
Both the work editor and public page use this catalogue. Known English labels,
Persian labels and legacy aliases are normalized to the same stored English role.
Unknown custom roles are kept. A person can hold multiple roles.

The existing `works.credits` JSON format is retained: `name`, `photo`, `roles` and
`character`. An optional `department` stores an explicit public section chosen
by the editor; omit it to classify automatically. Creative leads take priority,
then explicit AI assistant/model credits, then the first recognized role. Unknown
roles use Other contributions. Explicit valid departments override inference.

Directors and writers retain their featured layout. Other people appear once in
their primary department with all their roles shown. A performing role can show
a character even when the person's primary department is technical. Narrators,
motion capture performers and stunt performers are included. Removing a performing
role temporarily hides the character field but does not discard its saved text.

Game AI programmers are human engineering credits, separately from AI assistants.
Every role has a Persian caption; custom labels and people's names remain intact.
The editor supports department-filtered choices, typed custom roles, chip removal,
explicit display departments, photos and moving a person up within their section.

Tests cover legacy records, Persian aliases, duplicate roles, custom roles,
performers, AI classification, explicit departments and page script order.
The browser preview uses isolated sample credits and the actual editor/serialization
code; it does not save test credits to production.
