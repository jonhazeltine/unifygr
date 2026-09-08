# AI Art Direction

Use a consistent, welcoming visual language, with lighting suited to each ministry:

- Cinematic spiritual minimalism
- Deep blue and charcoal as an accent, with clear daylight, warm gold, and soft ivory as equal parts of the frame
- A faint cool-blue secondary glow
- Natural light and restrained texture; dramatic light beams and mist are optional for symbolic worship art, never requirements for everyday ministry scenes
- Human-scale composition, generous daylight, and calm framing
- Reverent and welcoming, never ominous or fantasy-game art
- No text, logos, UI, or obvious poster treatment inside the image

Global negative prompt:

`cartoon, anime, comic, low detail, cheesy church clipart, over-sharpened HDR, neon cyberpunk, purple fantasy, extra limbs, malformed hands, text, watermark, logo, frame, collage, split layout, blacked-out faces, children in shadow, children running away from camera, ominous doorway`

Hero prompt:

`A cinematic, reverent dawn scene over Grand Rapids with a clear blue sky, warm ivory light, and human-scale welcome; a luminous symbolic figure may be present but must read in soft daylight rather than as a black silhouette. Open composition, natural light behavior, calm premium editorial mood, wide hero image`

Worship prompt:

`A warmly lit church gathering, natural skin tones and clearly visible people, a calm sense of worship and shared attention, soft ivory and gold light, restrained editorial composition, no dramatic black silhouettes or invented church branding`

Prayer prompt:

`A quiet sunlit space for prayer, an open Bible and a chair beside a window, warm wood and soft ivory, peaceful and approachable, natural shadows with visible detail`

Mission prompt:

`Grand Rapids in clear morning light, streets and community life visible, warm and welcoming, natural colors and human-scale composition, no ominous skyline or supernatural beams`

Unity prompt:

`A bright shared table with chairs gathered around it, natural light and warm materials, a simple visual invitation to connection, calm and human-scale, no monumental dark landscape`

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
| worship-and-prayer | a warmly lit gathering with clearly visible people, or an airy prayer space |
| formation | an open Bible and notebooks around a sunlit study table |
| kids | a colorful activity table with blocks and a picture Bible in daylight; alternatively, approved photos of supervised children playing and learning |
| students | young people together in a safe park or bright shared space; no rooftop edges or isolated silhouettes |
| marriage-family | a family sharing an ordinary activity in a welcoming daylight setting |
| foster-adoption | a welcoming family space or approved family photo in natural light; no anonymous child at a dark doorway |
| men-women | a bright shared table ready for conversation, or an approved group photo |
| recovery | an open, peaceful garden path in daylight, suggesting support and hope without a tunnel or trapped figure |
| mental-health | a comfortable, light-filled space for conversation; avoid depicting someone as isolated or distressed |
| practical-care | clearly visible groceries and volunteers at a bright distribution table |
| health | a welcoming care setting with natural daylight and practical, familiar details |
| justice | a bright open path and welcoming community space; avoid prison-like scenery |
| mission | a recognizable city street or approved outreach photo in daylight |
| church-leaders | a bright table prepared for conversation and shared study |
| creative | colorful art materials or musical instruments in natural daylight |
| seniors | a welcoming garden bench or approved photo of older adults connecting in daylight |

**Children and families.** Do not use silhouettes, obscured faces, children
moving toward darkness, or isolated children. Use age-appropriate daylight,
visible supervision, ordinary play or belonging, and a clearly safe setting.

**Exposure and crops.** Check the actual desktop and phone crops. Subjects must
remain clearly visible without brightening a dark original. Family-card labels
sit below the image, so those images need no dark overlay. Where text overlaps
art, confine shading to the text area and verify readability.

**Source and approval.** Prefer suitable, approved real ministry photos when
available. Generated concepts must not imply they document our actual people or
facilities. Keep new generated art in a draft/review location until a person
approves the specific image for publication. A revised prompt is not approval
of a generated result.
