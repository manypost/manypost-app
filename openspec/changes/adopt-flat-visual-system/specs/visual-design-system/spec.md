## ADDED Requirements

### Requirement: Surfaces are flat

The interface MUST NOT simulate depth with fill gradients. Every surface — card, overlay, sidebar,
control and field — SHALL be a flat fill. `box-shadow` remains forbidden across the whole
application, so no surface may acquire depth by shadow either.

#### Scenario: A surface is rendered

- **WHEN** any card, overlay, control or field is rendered
- **THEN** its background is a flat fill
- **AND** it carries no fill gradient and no shadow

#### Scenario: A filled control is hovered

- **WHEN** a person hovers a filled control
- **THEN** the control transitions its colour
- **AND** it does not move, scale or change brightness as a substitute for a colour transition

#### Scenario: Depth is proposed again

- **WHEN** a future change proposes reintroducing gradient relief
- **THEN** the recorded history of its previous adoption and removal is available to that decision

### Requirement: Background layering is the primary hierarchy

The system SHALL express hierarchy through a fixed set of background layers: a page floor, a surface
layer, a recessed layer and a floating layer. The page floor SHALL be perceptibly below the surface
layer. The recessed layer SHALL NOT carry a border, because its fill is its boundary.

#### Scenario: A card sits on the page

- **WHEN** a surface-layer element is placed on the page floor
- **THEN** the two differ enough in fill for the surface to read as distinct without shadow or gradient

#### Scenario: A recessed element is rendered

- **WHEN** a tab rail, an inner tile or a code block is rendered
- **THEN** it is bounded by its own fill
- **AND** it carries no border of its own

### Requirement: The border scale has two steps, and component boundaries meet a contrast floor

The system SHALL provide exactly two border strengths. The decorative strength is used for dividers
and structure and has no contrast requirement. The strong strength MUST reach at least 3:1 against the
surface behind it and MUST be used wherever a border is the only thing identifying a component:
content rendered in a portal, and the boundary of an input control.

#### Scenario: An overlay opens over a surface of the same colour

- **WHEN** a dropdown, popover, select, dialog, sheet or command palette opens over a card of the same
  fill colour
- **THEN** its boundary is legible against that card
- **AND** the boundary meets the 3:1 floor

#### Scenario: An input sits inside a card

- **WHEN** an input, textarea or select trigger is rendered inside a surface of the same fill
- **THEN** its boundary meets the 3:1 floor

#### Scenario: A divider separates list rows

- **WHEN** rows of a list are separated
- **THEN** the decorative border strength is used
- **AND** no contrast floor applies, because the divider is not the sole identifier of a component

#### Scenario: The strong strength is weakened

- **WHEN** a change would lower the strong border below the 3:1 floor
- **THEN** it is refused, because the floor is the reason the token exists

### Requirement: The product uses one typographic scale

The system SHALL define a single named scale for the product interface and MUST NOT use unnamed or
raw size utilities within it. A separate editorial regime applies to marketing and identity surfaces
and is distinguished by its display typeface. Embedded provider post simulations MAY preserve the
external network's typographic proportions when required for preview fidelity; this representational
exception MUST be explicitly file-scoped and MUST NOT apply to surrounding product controls or labels.

#### Scenario: A product surface renders text

- **WHEN** text is rendered on an authenticated product screen
- **THEN** its size comes from the named product scale

#### Scenario: An editorial surface renders text

- **WHEN** a marketing, authentication or onboarding surface renders a large heading
- **THEN** the editorial regime applies and the product scale does not constrain it

#### Scenario: A provider post preview renders simulated content

- **WHEN** embedded content simulates how a post reads on an external provider
- **THEN** that simulated content may preserve provider-like type sizes and weights for fidelity
- **AND** the exception is restricted to the named preview implementation
- **AND** the surrounding Manypost interface still uses the named product scale

#### Scenario: A new text role appears

- **WHEN** a role appears that no existing step serves
- **THEN** a new named step is added to the scale
- **AND** an unnamed size is not introduced for that one case

### Requirement: The weight scale has three roles

The system SHALL use three text weights with distinct roles: a default for reading text, a medium for
labels and controls, and a semibold reserved for titles and active states. Bold SHALL NOT be used on
product surfaces.

#### Scenario: Body text is rendered

- **WHEN** a paragraph, description or data value is rendered
- **THEN** it uses the default weight and carries no weight class

#### Scenario: A label or control is rendered

- **WHEN** a field label, button, navigation item, table heading or badge is rendered
- **THEN** it uses the medium weight

#### Scenario: A title or an active item is rendered

- **WHEN** a section title or a selected navigation item is rendered
- **THEN** it uses the semibold weight

### Requirement: Product surfaces do not shout

The system MUST NOT upper-case label text on product surfaces. A label is distinguished by size and
colour. Upper-casing remains available only in the editorial regime.

#### Scenario: A section label is rendered

- **WHEN** a section heading, column heading or field label is rendered on a product screen
- **THEN** it is rendered in sentence case
- **AND** its role is signalled by size and colour

#### Scenario: A badge is rendered

- **WHEN** a state badge is rendered
- **THEN** it is identified by its fill and text colour
- **AND** it is not upper-cased

### Requirement: A region carries one level of border

When a container carries a border, its direct descendants MUST NOT carry their own. Homogeneous
children are separated by dividers on the container; heterogeneous children are separated by space.
An element a person drags, selects or reorders is an object and keeps its frame — and its container
then loses its own and becomes a stage.

#### Scenario: A list of like items is rendered

- **WHEN** a container holds rows of the same kind
- **THEN** the container carries the border and the rows are separated by dividers
- **AND** the rows carry no border of their own

#### Scenario: A heading, hint and action share a group

- **WHEN** unlike elements are grouped
- **THEN** they are separated by space
- **AND** they do not each acquire a border or a fill

#### Scenario: A board of draggable cards is rendered

- **WHEN** a container holds cards a person can drag
- **THEN** the cards keep their frames
- **AND** the container is a stage without a border of its own

#### Scenario: A region has nothing to show

- **WHEN** a region is empty
- **THEN** it states so without a dashed frame, because a dashed frame promises that something can be
  dropped there
- **AND** a dashed frame is used only where dropping is in fact possible

### Requirement: Layout spacing uses a closed scale

The system SHALL use the closed `4, 8, 12, 16, 24, 32px` spacing scale for layout, and MUST NOT
correct spacing with negative margins. Where spacing appears wrong, the grouping is wrong. Internal
geometry inside a shared component primitive is outside this layout scale and remains centrally
calibrated by that primitive.

#### Scenario: A screen composes its layout

- **WHEN** gaps or padding are applied on a product screen
- **THEN** the values come from the closed scale

#### Scenario: Two elements need to sit closer than their siblings

- **WHEN** a title and its hint must sit closer than the surrounding rhythm
- **THEN** they are wrapped in their own group with its own spacing
- **AND** a negative margin is not used to pull them together

### Requirement: The usable width is bounded once

The system SHALL bound the usable content width in the application shell, in one place, rather than
per screen. A single reading measure SHALL apply to descriptive paragraphs.

#### Scenario: A screen is opened on a very wide display

- **WHEN** any application screen is opened on a display wider than the bound
- **THEN** its content is bounded and centred rather than stretched to the edge

#### Scenario: A screen sets its own width

- **WHEN** a screen needs to be narrower than the shell bound, such as a form
- **THEN** it narrows within the shell bound rather than replacing it

#### Scenario: A descriptive paragraph is rendered

- **WHEN** a page or block description is rendered
- **THEN** it is constrained to the single reading measure

### Requirement: Screens do not animate their own arrival

The system MUST NOT stagger or animate the entrance of operational content. Content appears in its
final position.

#### Scenario: An operational screen loads

- **WHEN** an operational screen's content becomes available
- **THEN** it appears in place without a staggered entrance

#### Scenario: Urgent content is positioned late in the order

- **WHEN** a block that reports work needing attention is not the first block
- **THEN** its appearance is not delayed relative to the others

### Requirement: Control density is fixed and deliberate

The system SHALL keep its established control density: standard controls, navigation rows and
application chrome each at their current height. Deviations from the standard control height are
defects, not variants.

#### Scenario: A form control is rendered

- **WHEN** an input, select, textarea or standard button is rendered
- **THEN** it uses the standard control height

#### Scenario: A control deviates from the standard height

- **WHEN** a control is found at a non-standard height
- **THEN** it is corrected to the standard rather than the standard being widened to admit it

#### Scenario: Reducing density is proposed

- **WHEN** a change proposes reducing control density
- **THEN** the recorded decision and its cost are available to that decision

### Requirement: The authenticated product follows the approved editorial composition

The authenticated product SHALL use a warm page floor, a dark navigation rail and open work regions
as defined by the approved reference. The accent SHALL remain limited to primary action, focus and
explicit selection. Product screens MUST NOT regress into a uniform grid of equally weighted cards.

#### Scenario: A desktop product screen is opened

- **WHEN** an authenticated screen is rendered at desktop width
- **THEN** the persistent dark rail and warm workspace establish the primary hierarchy
- **AND** alignment, dividers and space group work before cards are introduced

#### Scenario: A narrow screen is opened

- **WHEN** the viewport is narrower than the desktop navigation breakpoint
- **THEN** navigation becomes a drawer with a compact topbar
- **AND** every global action remains reachable

### Requirement: Operational media is real and optional

Operational items MAY render the first media reference returned by the publication feed. The
interface MUST render a stable text-only layout when no preview exists and MUST NOT invent
placeholder imagery or capacity data.

#### Scenario: An image preview exists

- **WHEN** a feed item contains an image media preview
- **THEN** the related operational card may show it in a bounded 4:3 frame

#### Scenario: No preview exists

- **WHEN** a feed item contains no media preview
- **THEN** the card keeps its text hierarchy without reserving an empty image frame

#### Scenario: A video preview exists

- **WHEN** a feed item contains a video media preview
- **THEN** the card shows a neutral video tile instead of eagerly loading video content

### Requirement: The design document has one normative layer

`design.md` SHALL state current rules in its primary sections. Historical decisions MAY remain as a
record but MUST NOT override current rules through a trailing addendum.

#### Scenario: A mock or implementation reads the design system

- **WHEN** it follows the applicable primary section in `design.md`
- **THEN** it receives the current palette, typography, shell and component rules
- **AND** no later section contradicts those rules
