# Visual System: The Waiting Game

**Status:** Active source of truth for visual and UI decisions.
**Last updated:** 2026-04-24 via `$design-consultation`.
**Preview artifact:** `/tmp/design-consultation-preview-waiting-game.html`

`DESIGN.md` is the product and engineering planning document. This file is the visual system. Read this before making any UI, styling, animation, copy-presentation, or layout decision.

---

## 1. Core Direction

### Public Access Line Broadcast

The Waiting Game should feel like a continuous public-access broadcast of an impossible endurance line. The player received a bureau-issued number and has tuned in to watch the live feed until their box becomes relevant.

The interface is not a decorated game board. It is a broadcast system pointed at the line.

**Core rule:** The boxes are the program. The broadcast UI is the frame.

Everything on screen should reinforce that the user is watching a live transmission of thousands upon thousands of other people waiting:

- The checkbox field is the dominant first read.
- The line is visibly larger than the viewport.
- Scrolling the line is obvious, expected, and materially part of the experience.
- Broadcast graphics support orientation: live state, viewed range, alerts, camera/channel labels, and lower thirds.
- Bureau elements exist, but as metadata: issued number, contestant monitor, eligibility status, public record.

The product should not look like a generic dashboard, a terminal, a neon arcade, or a whimsical dark toy. It should look like a strange public-access station has been given responsibility for televising the queue.

## 2. Product Context

- **What this is:** A real-time anonymous queue rendered as a massive navigable line of checkboxes. Each user owns one checkbox and can check it only when every active box ahead of them has checked or departed.
- **Who it is for:** Internet people who understand the joy of absurd shared web experiments, live systems, and pointless endurance.
- **Space:** One Million Checkboxes, r/place, Blaseball, neal.fun-style web games, public-access oddities, and endurance contests.
- **Project type:** Single-page real-time web app/game.

## 3. Aesthetic

### Direction

**Public Access Line Broadcast**

The visual language comes from:

- Local public-access TV.
- Live broadcast graphics.
- Surveillance/control-room feeds.
- Numbered queue systems.
- Aging institutional equipment.
- Endurance contests that became serious through repetition.

It should feel live, plainspoken, slightly underfunded, and deeply committed to a premise nobody should have funded.

### Mood

Matter-of-fact broadcast seriousness applied to sustained absurdity. The system does not celebrate waiting. It televises waiting. It annotates waiting. It interrupts waiting with more waiting-related information.

The humor should come from official presentation, visible scale, and procedural indifference rather than jokes in the UI chrome.

### Things To Avoid

- Emoji bursts as a primary visual language.
- Purple/violet gradients.
- Centered landing-page hero layouts.
- Generic stat-card dashboards.
- Decorative SVG illustrations.
- A terminal/programmer-dark aesthetic.
- Cute childish fonts or overt toy styling.
- Randomized colors that make the system feel incoherent.
- UI chrome that competes with the checkbox field.

## 4. Hierarchy

### Primary Object: The Checkbox Broadcast

The checkbox line must be the largest, clearest, most physically present element on the page.

Requirements:

- Checkboxes are large enough to read as individual people/slots, not texture.
- The viewport shows enough boxes to imply crowd scale.
- The line visibly overflows the frame.
- Horizontal scrolling must be obvious through scrollbars, range labels, rulers, edge framing, or controls.
- Vertical density may be used to show more of the live field, but the central model remains a long line.
- The user should understand within one second that there are far more boxes than currently visible.

### Secondary Object: Broadcast Frame

The broadcast frame gives orientation and live energy:

- Channel/station ID.
- Live indicator.
- Camera or feed label.
- Visible range readout.
- Signal/subscription status.
- Clock or elapsed time.
- Lower-third ticker.
- Interruption alerts.

These elements should sit around or over the checkbox feed like TV graphics. They should not become the main visual event.

### Tertiary Object: Bureau Metadata

The bureau-issued number and contestant status are important, but they should not replace the boxes as the main premise.

Use bureau metadata for:

- "Your issued number."
- Current waiting place.
- Eligibility state.
- Nearby viewers.
- Elapsed wait.
- Departure count.
- Endurance hall records.

## 5. Layout

### Approach

**Broadcast-first app layout.**

The first viewport should behave like a live TV program:

1. Station strip at the top.
2. Program header with title and issued number.
3. Massive scrollable checkbox broadcast screen.
4. Lower-third activity/alert ticker.
5. Control deck for queue navigation.

### Grid

- Use full-width broadcast surfaces rather than isolated cards.
- Keep the main screen wide and dominant.
- Avoid nesting cards inside cards.
- Side panels should feel like TV overlays, not dashboard widgets.
- On mobile, preserve the idea of a scrollable broadcast feed instead of collapsing the boxes into a summary.

### Recommended First-Viewport Structure

```text
WGTV / station strip
------------------------------------------------------------
The Waiting Game                         Bureau-issued #N
------------------------------------------------------------
LIVE | Viewing #47,120 - #47,311 | Signal | Clock
------------------------------------------------------------
|                                                          |
|          HUGE SCROLLABLE CHECKBOX FIELD                 |
|          with ruler, overflow, and live overlays          |
|                                                          |
------------------------------------------------------------
LINE UPDATE | ticker text scrolls here | Scroll to inspect
------------------------------------------------------------
Controls: Check Box / Return To Mine / Watch Front / Watch Back
```

## 6. Color

### Approach

High-contrast broadcast equipment colors with public-access warmth.

The palette should feel like a studio monitor, channel graphics, cream title cards, and emergency interruption overlays.

### Core Palette

- **Control Black:** `#0d1419`
  - Primary background, monitor edges, deep broadcast frame.
- **Tube Field:** `#18222a`
  - Checkbox broadcast screen background.
- **Broadcast Cream:** `#f1ddb0`
  - Program headers, station labels, panel surfaces, readable warm neutral.
- **Paper:** `#f9edca`
  - Checkbox fill and form-like surfaces.
- **Channel Yellow:** `#f7c843`
  - Issued number, ruler, active attention, navigational emphasis.
- **Interruption Red:** `#d8433e`
  - Live chip, alerts, eligibility errors, critical activity.
- **Signal Cyan:** `#37b6c8`
  - Secondary broadcast graphics, camera/feed metadata, navigation.
- **Checked Green:** `#43c978`
  - Checked/completed box state and healthy signal.
- **Signal Blue:** `#315f8c`
  - Optional supporting color for secondary panels.
- **Dead-Air Gray:** `#7d868c`
  - Muted labels, disabled states, ghost metadata.

### Dark Mode

Dark mode should not invert the concept. It should feel like a dimmer control room:

- Keep `#070b0f` / `#101820` as the main dark surfaces.
- Keep cream/yellow readable and warm.
- Increase cyan/green brightness slightly.
- Use red sparingly so alerts remain meaningful.

### Semantic Usage

- **Success / checked:** `#43c978`
- **Warning / approaching relevance:** `#f7c843`
- **Error / not eligible / interrupted:** `#d8433e`
- **Info / subscribed / camera metadata:** `#37b6c8`
- **Ghost / departed:** reduced opacity plus gray diagonal treatment.

## 7. Typography

### Font Stack

- **Display / ceremonial numbers:** Fraunces
- **Body / UI / notices:** Source Sans 3
- **Data / telemetry / queue records:** IBM Plex Mono
- **Code/system fallback:** IBM Plex Mono

### Roles

**Fraunces**

Use for:

- Product title.
- Issued contestant number.
- Major section headings.
- Endurance records.

Do not use Fraunces for dense UI or long copy.

**Source Sans 3**

Use for:

- Body copy.
- Status explanations.
- Buttons where mono would feel too rigid.
- Chat and feed messages when readability matters.

**IBM Plex Mono**

Use for:

- Sequence numbers.
- Visible range readouts.
- Time, duration, counters.
- Station IDs.
- Camera/feed labels.
- Rulers.
- Lower thirds.
- Tables.

Use tabular numerals anywhere numbers need to align.

### Type Scale

- Hero/program title: `clamp(32px, 5vw, 68px)`
- Issued number: `clamp(28px, 4vw, 48px)` in overlays, larger when it is the current focus.
- Section heading: `clamp(32px, 4vw, 54px)`
- Body: `18px-20px`
- UI label: `12px-13px`, uppercase, mono, bold.
- Checkbox sequence labels: `8px-10px`, mono, only when useful.

## 8. Checkbox System

### Size

Checkboxes are not decorative. They represent people.

Default broadcast size:

- Box: `40px-52px`
- Gap: `10px-12px`
- Border: `2px-3px`

Compact secondary views may use:

- Box: `28px-34px`
- Gap: `8px-9px`

Avoid shrinking boxes into noise in the primary view.

### States

- **Waiting:** cream fill, dark/broadcast border.
- **Checked:** green fill with visible checkmark.
- **Mine:** yellow fill, red outline, subtle mechanical pulse.
- **Eligible:** red or yellow emphasis plus enabled pointer state.
- **Ghost/departed:** reduced opacity, diagonal gray/cream treatment, slow fade.
- **Unavailable/not mine:** visible but non-interactive; avoid making it look disabled to the point of disappearing.

### Scroll Cues

Always provide at least two scale cues near the checkbox field:

- Real scrollbars.
- Ruler labels such as `#47,120`, `#47,140`, `#47,160`.
- Visible range text such as `Viewing #47,120 - #47,311 of 98,442 active boxes`.
- Edge framing or clipping that shows the feed continues.
- Navigation controls: Watch Front, Return To Mine, Watch Back.

The high contestant number is not sufficient. The user must see the field exceed the frame.

## 9. Components

### Broadcast Screen

The main screen is a framed monitor/feed:

- Dark tube background.
- Cream or black outer frame.
- Top status row.
- Scrollable checkbox field.
- Lower-third ticker.
- Optional overlays for alerts and contestant monitor.

### Station Strip

Top-of-page station identification:

- `WGTV`
- Channel number.
- Public Access Waiting Service.
- Continuous Line Coverage.

Keep it compact and functional.

### Lower Third

Use for live updates:

- Departures.
- Winners.
- Eligibility changes.
- Maintenance notices.
- Range/subscription changes.

Tone should remain official and indifferent.

### Alert Overlay

Use sparingly for meaningful changes:

- Someone ahead departed.
- The user is now eligible.
- Connection/signal degraded.
- Maintenance imminent.

Alerts should feel like broadcast interruptions, not web toasts.

### Contestant Monitor

Small overlay or side panel:

- Your number.
- Waiting place.
- Nearby viewers.
- Elapsed wait.
- Eligibility.

This panel is secondary to the checkbox feed.

### Control Deck

Primary navigation and action controls:

- Check Box
- Return To Mine
- Watch Front
- Watch Back
- Jump to Sequence

Controls should feel like broadcast switcher buttons or municipal equipment: blunt, bordered, high contrast.

## 10. Motion

### Approach

Mechanical broadcast motion.

Use motion to make the feed feel live and to demand attention without turning the app into a carnival.

### Approved Motion

- Live dot blink.
- Lower-third crawl.
- Mechanical pulse on the user's box.
- Short alert interruption jitter.
- Slow ghost fade over 30 seconds.
- Subtle scanline/noise treatment.
- Snappy button press offsets.
- Horizontal scroll movement as the primary interaction.

### Timing

- Micro interactions: `80ms-120ms`
- Button/state transitions: `120ms-180ms`
- Alert entrance: `160ms-240ms`
- Ticker crawl: `20s-30s`
- Ghost fade: `30s`

### Avoid

- Bouncy toy motion.
- Large celebratory bursts.
- Scroll-jacking that fights manual inspection.
- Motion that hides checkbox state or makes eligibility ambiguous.

## 11. Copy Presentation

The copy voice remains deadpan, civic, and official, but the presentation layer is broadcast TV.

Examples:

- "The contest recognizes your continued presence."
- "Contestant #47,190 has departed."
- "The line has adjusted. Remain tuned."
- "Your box remains unavailable pending completion of prior obligations."
- "The front of the line advances without comment."
- "Viewport subscription active."

Avoid:

- Internet slang.
- Winking at the joke.
- Overexplaining the premise in marketing language.
- Copy that implies the system cares emotionally.

## 12. Design Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-24 | Replaced "Vibrant Indifference" with "Public Access Line Broadcast" | The prior system had the right tone references but did not make the checkbox line and scrollable scale dominant enough. |
| 2026-04-24 | Made the checkbox field the primary visual object | The product must immediately communicate that there are thousands upon thousands of boxes, not merely a high assigned number. |
| 2026-04-24 | Kept bureau framing as metadata rather than the main aesthetic | The player received a number, but the core experience is watching the live broadcast until that number matters. |
| 2026-04-24 | Selected Fraunces, Source Sans 3, and IBM Plex Mono | The combination provides ceremony, readability, and broadcast telemetry without relying on overused product fonts. |
