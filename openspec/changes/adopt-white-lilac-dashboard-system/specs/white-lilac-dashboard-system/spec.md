## ADDED Requirements

### Requirement: The authenticated shell uses the approved white-lilac composition

The system SHALL render a responsive shell with a gray-black 181px desktop sidebar, a 59px main
topbar, a near-white main surface and an optional dense right rail only when real secondary content
exists. The sidebar SHALL collapse to 64px and SHALL become a drawer below the desktop breakpoint.

#### Scenario: Desktop authenticated route opens
- **WHEN** an authenticated route is rendered at 1260px or wider
- **THEN** the sidebar is 181px and the main column includes a 59px topbar
- **AND** the topbar shows context, compact search and lightweight actions without duplicating the H1

#### Scenario: Tablet route opens
- **WHEN** an authenticated route is rendered below 1024px
- **THEN** the fixed sidebar is hidden and navigation remains available through the topbar drawer

#### Scenario: Sidebar is collapsed
- **WHEN** a person uses the persisted collapsed preference
- **THEN** the sidebar is 64px wide and every destination remains identifiable by tooltip or label

### Requirement: Product typography follows the compact Inter scale

Authenticated product surfaces MUST use Inter with named roles: 18px page title, 15–16px card title,
13px navigation/body, 11px metadata, 10px axes and 23px KPI figures. Product chrome MUST NOT use
weight 700, perceptible title tracking or multiline compact labels. Comparable values MUST use
tabular figures.

#### Scenario: Page header renders
- **WHEN** a product page header is visible
- **THEN** its H1 is 18px, medium weight, Inter and left aligned

#### Scenario: Compact data renders
- **WHEN** timestamps, counts or graph labels are shown
- **THEN** they use the named compact scale and tabular figures where values are compared

### Requirement: Surfaces use quiet borders, role radii and restrained color

The system SHALL use near-white main surfaces, white cards, one-pixel subtle borders and role-based
4/5/8/10/11/12px radii. Persistent cards MUST NOT use shadows. Purple SHALL be reserved for brand,
selection and primary visualization; teal SHALL be reserved for secondary data; lilac and pale blue
fills SHALL identify compact KPI-like summaries.

#### Scenario: Analytical card renders
- **WHEN** a persistent analytical card is shown
- **THEN** it has a white surface, subtle one-pixel border, approximately 11px radius and no shadow

#### Scenario: KPI summary renders
- **WHEN** a block contains one compact operational value
- **THEN** it may use lilac or pale-blue fill with 12px radius and no visible border or shadow

#### Scenario: Ordinary control renders
- **WHEN** a navigation item, field or icon tile is shown
- **THEN** it uses the documented 10px control radius rather than inheriting a universal card radius

### Requirement: Shadows and gradients have narrow semantic ownership

The system MUST allow shadow only in the tooltip primitive. It MUST allow gradients only through
named data-visualization utilities for active bars, donut segments or subtle area fills. Shell,
navigation, buttons, fields and persistent cards MUST use solid fills.

#### Scenario: Tooltip opens
- **WHEN** a tooltip appears above content
- **THEN** it uses the single short dark tooltip shadow token

#### Scenario: Data visualization highlights a series
- **WHEN** an active bar, donut segment or area series is rendered
- **THEN** it may use the named visualization gradient and no component surface inherits it

#### Scenario: Persistent product surface renders
- **WHEN** a card, button, navigation item or field is rendered
- **THEN** it has no shadow and no fill gradient

### Requirement: Home uses the dashboard grammar with real operational data

The Home SHALL map its existing operational blocks onto aligned main and secondary regions, using
compact KPI fills and bordered analytical cards without introducing engagement metrics, fake people
or placeholder values. Empty, loading and error states SHALL preserve the same geometry.

#### Scenario: Home has operational summaries
- **WHEN** real summary data is available
- **THEN** aligned compact summaries use lilac and pale-blue emphasis while detailed blocks use white analytical cards

#### Scenario: Home lacks a block's data
- **WHEN** a real data source is empty or fails
- **THEN** the surface hides or reports that block according to existing behavior and does not insert sample data

### Requirement: Quadro preserves operations inside the dashboard grammar

The Quadro SHALL keep its five real states, filters, URL state, density, selection, bulk operations,
pointer and keyboard drag, media previews, failures and confirmations while presenting them inside a
quiet white work surface with compact lane headers and subtle separators. The system MUST NOT show
capacity values that do not exist.

#### Scenario: Quadro renders at desktop width
- **WHEN** the five states are visible
- **THEN** they share one bordered work surface with aligned compact headers and subtle separators
- **AND** cards remain individually identifiable without heavy borders or shadows

#### Scenario: Quadro renders below its readable minimum
- **WHEN** the viewport cannot fit five readable lanes
- **THEN** lanes scroll horizontally instead of compressing content or hiding operations

#### Scenario: A failure card renders
- **WHEN** a publication needs human action
- **THEN** its reason and retry remain visible and semantic red does not become a decorative surface color

### Requirement: The reference adapts rather than becoming a fixed screenshot frame

The system MUST preserve the reference's visual proportions responsively and MUST NOT ship a fixed
1200×900 frame, artificial 98×87 offset, cropped panel or fabricated reference content.

#### Scenario: Product runs on a wide display
- **WHEN** the browser is wider than the measured reference
- **THEN** the shell uses its responsive maximums and does not remain offset inside a 1200px canvas

#### Scenario: Product runs on mobile
- **WHEN** the viewport is below 768px
- **THEN** content becomes one column where appropriate while colors, typography, borders and hierarchy remain consistent
