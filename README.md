# Free software hub

Free, open-source software from Clear Frameworks and the Coders for Humanity community. Find an app, download its complete source, and use or adapt your own copy. You can work on the code yourself or with an AI assistant.

## Get software

| Software | What it does | Get it |
| --- | --- | --- |
| **[Your finances](products/finance-workspace/)** | A local planner for paydays, bills, transaction imports, and spending comparisons. No account or AI subscription required. | **[Download ZIP](https://github.com/clearframeworks/coders-for-humanity/raw/refs/heads/main/public/downloads/finance-workspace.zip)** · [Source](products/finance-workspace/) · [Product page](https://cfh.retehost.com/software/finance-workspace) |
| **[CFH community platform](docs/community-platform.md)** | A shared workspace for public-interest projects, contributions, and handoffs. | [Visit CFH](https://cfh.retehost.com) · [Full repository ZIP](https://github.com/clearframeworks/coders-for-humanity/archive/refs/heads/main.zip) · [Source and setup](docs/community-platform.md) |

**Start Your finances on Windows:** extract the ZIP, open its `finance-workspace` folder, and double-click **Start-Finances.cmd**. It sets up its runtime if needed and opens the app. First setup may need internet access. No administrator install is needed. macOS and Linux use Node.js 24 or newer with `npm start`.

The finance app starts empty and stores your records on your computer. AI assistance is optional. The community platform has its own hosting and account setup; see its guide when running your own copy.

**[Browse the product folders](products/)** · **[Browse software on the web](https://cfh.retehost.com/software)**

## Inside this repository

Each downloadable app has its own folder under [`products/`](products/), with source, a license, and its start or setup files. The web catalog and dedicated product pages live under [`app/software/`](app/software/); ready-to-download packages live under [`public/downloads/`](public/downloads/).

The CFH community platform also lives here. Its application source is in [`app/`](app/), [`components/`](components/), and [`lib/`](lib/). Its [development and operating guide](docs/community-platform.md) includes setup, verification, architecture, and provider requirements.

## Improve or add software

Open an [issue](https://github.com/clearframeworks/coders-for-humanity/issues) for a bug, idea, or question. To contribute changes, follow [CONTRIBUTING.md](CONTRIBUTING.md). New products should follow the [product folder guide](products/README.md#adding-a-product): complete source, a dedicated landing page, a usable download, and the simplest honest setup path.

Maintainers: run the [repository checks](docs/community-platform.md#verification). After finance source changes, regenerate its download with `python scripts/build-product-downloads.py`; CI verifies that the package matches the source.

## License

Application code is [MIT licensed](LICENSE). Check each product's license and any third-party asset notices. Logos and names do not transfer trademark rights. Report security issues through [SECURITY.md](SECURITY.md).
