# AI Art Direction

Use one visual language across every image:

- Cinematic spiritual minimalism
- Midnight blue and charcoal base
- Warm gold halos and soft ivory light
- A faint cool-blue secondary glow
- Volumetric light beams, mist, and soft grain
- Monumental composition, negative space, and calm framing
- Reverent tone, not fantasy-game art, not kitsch church stock
- No text, logos, UI, or obvious poster treatment inside the image

Global negative prompt:

`cartoon, anime, comic, low detail, cheesy church clipart, smiling stock models, over-sharpened HDR, neon cyberpunk, purple fantasy, extra limbs, malformed hands, text, watermark, logo, frame, collage, split layout`

Hero prompt:

`A cinematic, reverent portrait scene of Jesus as a luminous silhouette standing above a dark city at dawn, centered composition, monumental scale, robe shape readable but facial features mostly lost in shadow, radiant warm halo, soft volumetric light beams descending from above, midnight blue and charcoal environment, pale gold rim light, faint blue atmospheric haze, minimal but emotionally powerful, Apple-launch-level restraint, premium editorial lighting, ultra cohesive color palette, realistic light behavior, wide hero image`

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

`Cinematic spiritual minimalism, midnight blue and charcoal palette, warm gold light, faint cool-blue secondary glow, visible volumetric light beams, soft mist and fine grain, monumental composition with generous negative space, reverent and restrained. Luminous and generously lit — the light fills much of the frame and the subject reads clearly; rich midtones, not underexposed, not a black frame. Premium editorial lighting, realistic light behaviour, no faces visible, no text or logos.`

Per-area subjects (change only this half):

| Area | Subject |
|---|---|
| worship-and-prayer | glowing circular window of light above a congregation in silhouette |
| formation | long table, one open book under a hanging lamp, empty chairs |
| kids | children in silhouette running toward a tall lit doorway |
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

**Exposure rule.** The card crops a short horizontal band and lays a gradient over
it, so anything underexposed becomes a black rectangle. After generating,
normalise the whole set to a mean luminance of ~56 with a per-image gamma
(floor the gamma at 0.42 so noise is not lifted out of true black). Straight
out of the model these ranged 15–55; without the pass the set looks unrelated.
