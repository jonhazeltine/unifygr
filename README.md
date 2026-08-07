# unifygr

The website for **New Life Grand Rapids** — [unifygr.com](https://unifygr.com).

An Astro 5 site (MDX, RSS, sitemap, React islands) with TinaCMS for content
editing and an in-site Page Builder / Studio for staff. It deploys to **Vercel**
via `@astrojs/vercel`; every push to `main` ships, and pull requests get a
preview deployment.

## 🚀 Project Structure

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

The `src/content/` directory contains "collections" of related Markdown and MDX documents. Use `getCollection()` to retrieve posts from `src/content/blog/`, and type-check your frontmatter using an optional schema. See [Astro's Content Collections docs](https://docs.astro.build/en/guides/content-collections/) to learn more.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                                     |
| :------------------------ | :--------------------------------------------------------- |
| `npm install`             | Installs dependencies                                       |
| `npm run dev`             | Starts local dev server at `localhost:4321`                 |
| `npm run cms`             | Dev server + the TinaCMS editor at `/admin`                 |
| `npm run build`           | Build your production site to `./dist/`                     |
| `npm run check`           | Build and type-check — run this before pushing              |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check`            |
| `npm run astro -- --help` | Get help using the Astro CLI                                |
| `npx vercel dev`          | Run the built site locally the way Vercel serves it         |

## Deploying

Deploys are automatic. Merging to `main` builds and promotes to production on
Vercel; opening a pull request builds a preview. There is nothing to run by hand.

## 👀 Want to learn more?

Check out [Astro's documentation](https://docs.astro.build) or jump into the [Astro Discord server](https://astro.build/chat).

## Credit

The original theme this started from is the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
