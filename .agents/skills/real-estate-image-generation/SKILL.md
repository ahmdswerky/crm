---
name: real-estate-image-generation
description: Generate and save a cohesive set of ultra-realistic real-estate images with Codex image generation. Use when the user asks for property imagery for a mansion, apartment, land plot, villa, commercial building, penthouse, or another real-estate listing, especially when they need a main exterior image plus matching indoor and outdoor views.
---

# Real Estate Image Generation

This skill turns a property brief into a consistent image set using Codex's image-generation tool. It creates the primary building image first, then generates supporting views that preserve the same architecture, materials, landscaping, lighting language, and location cues, saving the finished set under `public/seed-images/<property-name>/`.

## When to use

Use this skill for listing or marketing imagery of:

- mansions and villas
- apartments and small apartments
- land or development plots
- commercial buildings
- penthouses

Trigger on requests such as “create an image of a villa,” “generate listing photos for this penthouse,” or “make 6 realistic images of the same apartment.” If the user provides a reference image or asks to edit an existing property image, use the same consistency rules while passing the reference image to the image-generation tool.

## Workflow

1. Extract the property brief. Identify the property type, architectural style, approximate scale, setting, climate, materials, colors, landscaping, time of day, camera preferences, and any must-keep details. Infer only ordinary visual details; ask one concise question only when a missing detail would materially change the property.

2. Decide the set size. The first image is always the hero exterior. Add supporting images as follows:

   - Standard properties: 4–6 additional images, for 5–7 total.
   - Small apartments or similarly compact places: 2 additional images, for 3 total.
   - Land plots: 2–4 additional images, mixing an aerial/site context view with eye-level access, boundaries, terrain, and surroundings.

   When the user specifies a count, honor it unless it conflicts with the small-property rule; explain the adjustment briefly.

3. Generate the hero image first with `image_gen__imagegen`. Make it an ultra-realistic, high-end real-estate photograph showing the full building or site clearly. Use a believable camera height, natural perspective, realistic materials, physically plausible lighting, crisp architectural detail, and restrained editorial color grading. Avoid text, logos, watermarks, invented signage, visible people unless requested, and impossible geometry.

4. Generate the supporting views one at a time or in a small coherent batch, using the hero image as the visual reference whenever the tool supports it. Do not redesign the property between images. Maintain the same façade, floor count, window rhythm, roofline, materials, furniture language, landscaping, weather, and surrounding context.

5. Vary coverage rather than repeating the hero. Select views appropriate to the property:

   - exterior approach or alternate façade
   - entrance, courtyard, pool, terrace, garden, or balcony
   - living room, kitchen, dining area, bedroom, bathroom, office, or retail/office interior
   - rooftop, penthouse terrace, parking, street frontage, or shared amenity
   - aerial or wider site context for land and large developments

   For a small apartment, prefer one hero exterior plus two useful interior views, such as the living area and kitchen/bedroom, instead of pretending the unit has many rooms.

6. Save the image artifacts. Resolve `public/seed-images` from the project/repository root and create a subfolder named after the property. Convert the property name to a stable filesystem-safe slug: lowercase, trim whitespace, replace spaces and punctuation with hyphens, collapse repeated hyphens, and remove leading/trailing hyphens. If no property name is provided, derive a concise descriptive slug from the brief, such as `modern-stone-villa` or `downtown-penthouse`.

   Use deterministic filenames in generation order:

   - `01-hero-exterior.png`
   - `02-<view-name>.png`, `03-<view-name>.png`, and so on

   Preserve the highest-quality artifact available and use the format returned by the image tool when PNG is unavailable. Do not overwrite an existing property set silently; if the folder already contains images, create a new suffixed folder such as `<property-name>-2`, unless the user explicitly asks to replace or continue that set. If the image tool exposes only a display result and no local artifact, do not claim the files were saved; report that limitation clearly.

7. Return the generated images with concise labels such as “Hero exterior,” “Living room,” or “Rear garden,” and include the absolute or workspace-relative save folder. Mention the final count and any assumption that materially shaped the set.

## Prompt construction

Build each image-generation prompt from these parts:

`same [property type] as the reference; [fixed identity and architecture]; [specific scene/view]; [camera and composition]; [lighting and weather]; ultra-realistic professional real-estate photography, physically accurate materials, natural proportions, fine detail, no text, no watermark, no logo`

State fixed identity details explicitly in every supporting prompt. For example: “the same two-story white-stone villa with dark bronze window frames, flat roof, olive trees, and a rectangular pool.” Do not use vague phrases such as “a similar house” when consistency matters.

## Quality guardrails

- Realism comes before spectacle: use natural lens perspective, plausible daylight, correct scale, believable reflections, and lived-in but uncluttered interiors.
- Keep architecture coherent: doors, windows, stairs, columns, pools, rooflines, and room connections must not morph between images.
- Make interiors consistent with the exterior’s style, palette, materials, and quality level.
- Do not add claims the user did not provide, such as a view of a specific landmark, a precise location, number of bedrooms, branded appliances, or construction status.
- Avoid common generation defects: warped straight lines, duplicate furniture, floating objects, malformed railings, extra floors, unreadable signage, over-sharpening, plastic-looking surfaces, and dramatic lighting that hides the property.
- If the brief is intended for a listing, favor clean horizontal compositions suitable for a gallery. Use portrait or square framing only when requested.

## Reference-image handling

Before editing a user-supplied image, inspect it if a local path is available. Use `referenced_image_paths` for local reference files; otherwise include the smallest number of recent conversation images needed with `num_last_images_to_include`. Never provide both mechanisms. For a brand-new property with no reference, omit both parameters.

For an edit, preserve the building identity and change only what the user requests. For a new supporting view, use the hero image as the reference and describe the desired camera position and scene explicitly.
