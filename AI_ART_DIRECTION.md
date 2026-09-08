# AI Art Direction

Use one visual language across every image:

- Cinematic spiritual minimalism
- Deep blue and charcoal as an accent, with clear daylight, warm gold, and soft ivory as equal parts of the frame
- A faint cool-blue secondary glow
- Volumetric light beams, mist, and soft grain
- Human-scale composition, generous daylight, and calm framing
- Reverent and welcoming, never ominous or fantasy-game art
- No text, logos, UI, or obvious poster treatment inside the image

Global negative prompt:

`cartoon, anime, comic, low detail, cheesy church clipart, over-sharpened HDR, neon cyberpunk, purple fantasy, extra limbs, malformed hands, text, watermark, logo, frame, collage, split layout, blacked-out faces, children in shadow, children running away from camera, ominous doorway`

Hero prompt:

`A cinematic, reverent dawn scene over Grand Rapids with a clear blue sky, warm ivory light, and human-scale welcome; a luminous symbolic figure may be present but must read in soft daylight rather than as a black silhouette. Open composition, natural light behavior, calm premium editorial mood, wide hero image`

Worship prompt:

`A cinematic worship environment with a glowing circular window of light above a gathered congregation in silhouette, reverent and quiet, no stage clutter, dark sanctuary, warm gold illumination, soft haze, minimal composition, premium editorial atmosphere, midnight blue palette with ivory highlights`

Prayer prompt:

`A cinematic night prayer scene with a solitary kneeling figure in silhouette beneath a large moonlike halo, cool dark landscape, warm gold light touching the figure, subtle mist, contemplative, minimal, elegant, premium spiritual editorial style`

Mission prompt:

`A cinematic city mission scene at blue hour, layered urban skyline with soft warm windows, one radiant source of light breaking across the city, sense of movement outward and blessing, moody midnight palette, gold and ivory accents, atmospheric haze, minimal and premium`

Unity prompt:

`A cinematic symbolic unity scene with converging paths of light leading toward a central radiant source over a dark landscape and distant city, calm, monumental, midnight blue and charcoal, gold halo light, soft mist, restrained premium composition, spiritual but contemporary`

Recommended generation settings:

- Aspect ratio:
  - Hero: `4:3` or `16:10`
  - Section images: `4:3`
- Keep prompt style consistent across all images.
- Reuse the same seed family when the tool supports it.
- Reduce prompt variation between scenes; change only subject matter.

## Ministry card art

One image per ministry area in `public/art/ministries/<family-slug>.jpg`, 900×600.
Sixteen areas, sixteen distinct images — no sharing between areas.

Shared spine, appended to every per-area subject so the set reads as one family:

`Cinematic spiritual minimalism with natural daylight, warm gold and soft ivory light, blue used as an accent, subtle haze and fine grain, generous negative space, welcoming and restrained. The subject reads clearly in rich midtones; never underexposed or a black frame. Premium editorial lighting, realistic light behaviour, no text or logos.`

Per-area subjects (change only this half):

| Area | Subject |
|---|---|
| worship-and-prayer | glowing circular window of light above a congregation in silhouette |
| formation | long table, one open book under a hanging lamp, empty chairs |
| kids | diverse elementary-age children playing together outdoors in bright morning light, faces naturally visible, an adult leader nearby, safe and joyful rather than posed |
| students | young figures on a rooftop edge at blue hour, city glow beyond |
| marriage-family | two figures walking a narrow lit path together |
| foster-adoption | an adult and a child at a warmly lit doorway, seen from behind |
| men-women | a circle of empty chairs under one hanging lamp |
| recovery | a figure walking out of a tunnel into warm gold light |
| mental-health | a figure at a tall window as dawn floods a quiet room |
| practical-care | a lit doorway at night, crates stacked in silhouette outside |
| health | a bedroom at dawn, light across a made bed and a glass of water |
| justice | a heavy gate standing open, dawn light flooding through |
| mission | city skyline at blue hour, one light breaking outward across it |
| church-leaders | an empty lectern under a broad shaft of light |
| creative | light through a tall patterned window, instruments in silhouette |
| seniors | two figures on a bench facing a golden horizon over water |

**Children and families.** Do not use silhouettes, obscured faces, children
moving toward darkness, or isolated children. Use age-appropriate daylight,
visible supervision, ordinary play or belonging, and a clearly safe setting.

**Exposure rule.** The card crops a short horizontal band and lays a text
gradient over it. Generate a well-exposed original with a mean luminance around
56 or higher; preserve real daylight and skin tones rather than lifting a dark
frame afterward.
