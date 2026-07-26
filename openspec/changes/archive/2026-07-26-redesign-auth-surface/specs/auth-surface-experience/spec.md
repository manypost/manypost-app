## ADDED Requirements

### Requirement: Every authentication input states what it expects
Each text input on the authentication surface SHALL carry a placeholder that
demonstrates the expected value rather than repeating its own label. The
placeholder MUST be static interface copy translated through the `auth`
namespace and MUST NOT contain a real e-mail address, credential, personal
datum or environment value. The placeholder MUST NOT be the only carrier of a
rule the person still needs after typing begins.

#### Scenario: E-mail field is rendered
- **WHEN** the login or registration form renders its e-mail field
- **THEN** the field SHALL expose a placeholder demonstrating an e-mail address shape, and the field SHALL keep its visible label

#### Scenario: Password field is rendered
- **WHEN** the login or registration form renders its password field
- **THEN** the field SHALL expose a placeholder, and on registration the persistent minimum-length rule SHALL remain visible in a description that does not disappear once typing starts

#### Scenario: Verification code field is rendered
- **WHEN** the e-mail verification step or the second-factor step renders its code field
- **THEN** the field SHALL expose a placeholder demonstrating the expected digit count

#### Scenario: Placeholder contains no real datum
- **WHEN** any placeholder string is added to the `auth` translation namespace
- **THEN** it MUST NOT contain a real address, credential, token or personal datum

### Requirement: Password visibility toggle is operable by keyboard
The control that toggles password visibility SHALL be reachable and operable
through the keyboard, SHALL expose its pressed state, and SHALL affect only
visibility, never the field's value.

#### Scenario: Keyboard user reaches the toggle
- **WHEN** a person moves focus forward from the password field using the keyboard
- **THEN** the visibility toggle SHALL receive focus with a visible focus indicator and SHALL be activatable without a pointer

#### Scenario: Toggle reports its state
- **WHEN** the toggle is activated
- **THEN** it SHALL report the new state to assistive technology and the field's value SHALL be unchanged

### Requirement: Stage artwork proves its own headline
Each brand-stage slide SHALL present artwork that depicts the claim made by
that slide's headline, and MUST NOT depict a mock source-code editor as the
proof of any claim. The opening slide SHALL depict the connection story it
announces: entry points on one side, the Manypost hub in the centre and the
supported networks on the other side, following the same structural pattern as
the marketing site's connection diagram.

#### Scenario: Opening slide is shown
- **WHEN** the stage displays the opening slide
- **THEN** its artwork SHALL depict grouped entry points, a central hub and the supported networks, connected in that order

#### Scenario: Connector meets a grouping bracket
- **WHEN** a connector line meets the bracket that gathers a group
- **THEN** the line SHALL meet the bracket without a visible gap, so the connection reads as continuous

#### Scenario: Third-party channel marks are presented
- **WHEN** the stage renders a third-party channel mark
- **THEN** it SHALL render the mark unaltered in colour and shape, and SHALL treat it as decorative with the channel name available as text

### Requirement: Stage composition holds its height across slides
The brand stage SHALL reserve one fixed frame shared by every slide so that
advancing between slides does not change the height or vertical position of the
stage's heading, artwork area, controls or footer.

#### Scenario: Slides are advanced
- **WHEN** the stage advances from any slide to any other slide
- **THEN** the vertical position of the stage controls and footer SHALL remain unchanged

#### Scenario: Slide content is shorter than the frame
- **WHEN** a slide's artwork occupies less than the reserved frame
- **THEN** the frame SHALL absorb the difference without leaving the controls detached from the composition

### Requirement: Stage controls form one cluster that exposes autoplay progress
Pagination and previous/next controls SHALL be presented as a single grouped
control cluster rather than separated across the panel, and the cluster SHALL
indicate progress toward the next automatic advance. Autoplay SHALL pause while
the stage is hovered or contains focus, and SHALL be suppressed entirely when
reduced motion is requested.

#### Scenario: Person hovers or focuses the stage
- **WHEN** the pointer enters the stage or focus moves into it
- **THEN** automatic advancing SHALL pause and the progress indication SHALL stop advancing

#### Scenario: Reduced motion is requested
- **WHEN** the person's system requests reduced motion
- **THEN** the stage SHALL NOT advance automatically, SHALL NOT animate transitions, and SHALL remain fully operable through the pagination and previous/next controls

#### Scenario: Person selects a specific slide
- **WHEN** a pagination control is activated
- **THEN** that slide SHALL become current, SHALL be reported as selected to assistive technology, and the progress indication SHALL restart

### Requirement: Only the current slide is exposed to assistive technology
The stage SHALL expose exactly one current slide to assistive technology and
keyboard navigation at a time, and SHALL keep the non-current slides out of the
accessibility tree and out of the tab order.

#### Scenario: Assistive technology reads the stage
- **WHEN** the stage is reached by assistive technology
- **THEN** only the current slide's content SHALL be reachable, and each slide's position within the total SHALL be announced

#### Scenario: Keyboard user tabs through the stage
- **WHEN** a keyboard user moves through the stage
- **THEN** focus MUST NOT enter a slide that is not current

### Requirement: Stage motion is orchestrated and suppressible
Stage motion SHALL run only when reduced motion is not requested, SHALL be
purely decorative, and MUST NOT gate the appearance of any content. The
diagram's connector lines and grouping brackets SHALL remain static; motion on
the opening slide belongs to the central hub. No interaction on the
authentication surface SHALL animate an element's position or scale on hover.

#### Scenario: Reduced motion is requested
- **WHEN** the person's system requests reduced motion
- **THEN** every slide's heading and artwork SHALL be fully visible in their final state without animation

#### Scenario: Pointer hovers an interactive element
- **WHEN** a pointer hovers any control on the authentication surface
- **THEN** the control SHALL transition colour or brightness only, and MUST NOT translate, scale or rotate

### Requirement: Stage sequencing logic is testable without a browser
The stage's current-index, wrap-around and autoplay decisions SHALL live in a
module that is importable and assertable without a DOM, so the behavior can be
verified by unit test rather than only by inspection.

#### Scenario: Index advances past the last slide
- **WHEN** the index is advanced from the last slide
- **THEN** the module SHALL resolve to the first slide

#### Scenario: Index moves back from the first slide
- **WHEN** the index is moved back from the first slide
- **THEN** the module SHALL resolve to the last slide

#### Scenario: Autoplay eligibility is evaluated
- **WHEN** the stage is paused or reduced motion is requested
- **THEN** the module SHALL report that automatic advancing is not eligible to run

### Requirement: Authentication surface adapts across supported widths
The authentication surface SHALL remain usable and composed from a narrow
handset width through a wide desktop width. The form column SHALL never
overflow horizontally, and when the brand stage is not displayed the surface
SHALL still state what the product does.

#### Scenario: Surface is viewed on a narrow handset
- **WHEN** the surface is displayed at a narrow handset width
- **THEN** the form SHALL remain fully readable and operable, the page MUST NOT scroll horizontally, and a summary of the product's promise SHALL be present

#### Scenario: Surface is viewed below the stage breakpoint
- **WHEN** the viewport is too narrow to display the brand stage
- **THEN** the stage SHALL be omitted rather than compressed, and the form column SHALL occupy the surface without stranding the wordmark or the card

#### Scenario: Surface is viewed on a wide desktop
- **WHEN** the surface is displayed at a wide desktop width
- **THEN** the stage artwork SHALL stay within the panel's padding and MUST NOT be clipped by the panel edge

### Requirement: Authentication behavior is unchanged by presentation work
The presentation of the authentication surface SHALL NOT alter authentication
behavior. Routes, submitted values, authenticator calls, verification steps,
error surfacing, session finalization and redirect validation MUST remain as
specified by the authentication capability.

#### Scenario: Person submits credentials
- **WHEN** a person submits the login or registration form
- **THEN** the values submitted and the authenticator calls made SHALL be identical to those made before the presentation change

#### Scenario: Redirect destination is supplied
- **WHEN** a destination parameter is supplied to the login route
- **THEN** the existing validation SHALL still reject any value that is not an internal path, unchanged by this work

#### Scenario: Authenticator reports an error
- **WHEN** the authenticator reports a field or global error
- **THEN** the surface SHALL present it in the existing alert treatment without suppressing or reformatting the authenticator's message
