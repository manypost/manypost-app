## MODIFIED Requirements

### Requirement: Consumption is recorded per operation

The system SHALL record, for each reservation, the organization, the operation
that requested it, the estimate, the outcome and the tokens consumed, so an
operator can attribute cost. That record MUST NOT contain the prompt, the
generated content, the API key or the vendor identity.

Operations SHALL be charged in cost classes that reflect what they actually cost
to serve. Producing an image is an order of magnitude more expensive than
producing text and SHALL carry its own class rather than being charged as one
text generation; and a single request SHALL never produce several images, so the
cost of one call stays bounded and predictable.

#### Scenario: Operator inspects consumption

- **WHEN** an operator reads the consumption records for an organization
- **THEN** each record identifies the operation and what it consumed

#### Scenario: Records carry no content and no secret

- **WHEN** any consumption record is written
- **THEN** it contains neither prompt text, generated text, nor any credential

#### Scenario: An image costs more than a caption

- **WHEN** an image generation and a caption generation are both recorded
- **THEN** the image's reservation is larger, in its own cost class

#### Scenario: One request, one image

- **WHEN** an image is requested
- **THEN** exactly one image is produced and charged
</content>
