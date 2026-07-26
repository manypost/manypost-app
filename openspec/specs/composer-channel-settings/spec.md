# composer-channel-settings Specification

## Purpose
TBD - created by archiving change improve-settings-ux. Update Purpose after archive.
## Requirements
### Requirement: Each settings field renders with a control that fits its meaning

The composer SHALL choose the control for a settings field from what the field is, not only from its
storage type. A field that stores a date SHALL offer a date picker; a field that stores a list SHALL
offer a per-item editor; a field that stores a URL SHALL offer a URL input; a field that references
media SHALL offer the media picker; a field with a fixed set of named options SHALL offer that named
list. A plain text box is the fallback only when nothing more specific applies.

#### Scenario: A date field is edited with a date picker

- **WHEN** a settings field declares the date-time format
- **THEN** the composer SHALL render the brand date/time picker
- **AND** SHALL read and write the field as the same instant the schema stores

#### Scenario: A list field is edited item by item

- **WHEN** a settings field is an array of strings
- **THEN** the composer SHALL render each value as a removable item and let the user add one at a time
- **AND** SHALL NOT require the user to separate values with a delimiter in a single text box
- **AND** WHEN the field declares a maximum count, the composer SHALL stop accepting new items at that
  count

#### Scenario: A named-list field is chosen by name

- **WHEN** a settings field has a fixed set of allowed values
- **THEN** the composer SHALL present them as named options
- **AND** the user SHALL NOT need to know the underlying code or id to choose one

#### Scenario: A URL field is validated as it is entered

- **WHEN** a settings field declares the URI format
- **THEN** the composer SHALL render a URL input that signals an invalid address before scheduling

### Requirement: A settings field can reference org media resolved at publish

A provider MAY declare that certain settings keys hold an **org media id** rather than a literal
value. For such a field the composer SHALL let the user pick from the org's media library, and the
stored settings SHALL keep the media id. The platform SHALL resolve the id to a public URL and pass
the URL to the provider at publish time, so the provider never receives a raw id.

#### Scenario: The stored value is the media id, so the post stays editable

- **WHEN** a user selects an image for a media-settings field and schedules the post
- **THEN** the stored settings SHALL contain the media id, not a resolved URL
- **AND** reopening the post SHALL show that image still selected

#### Scenario: The provider receives a URL, not an id

- **WHEN** a publication with a media-settings field is published
- **THEN** the platform SHALL resolve the media id to a public URL through the org-scoped media
  repository
- **AND** SHALL pass the URL to the provider in place of the id

#### Scenario: A media id from another org is not resolved

- **WHEN** a media-settings id does not belong to the publishing org
- **THEN** the resolution SHALL find nothing and the field SHALL be left unset
- **AND** the publication SHALL NOT fail because of it

#### Scenario: Resolution is unavailable

- **WHEN** the publish path has no media or storage dependency configured
- **THEN** the media-settings field SHALL be left unset rather than passed as a raw id
- **AND** the publication SHALL proceed, because the only current media-settings use is best-effort

