# 🥁 no. 2 Drummer ✏️

<iframe src="https://giphy.com/embed/l0MYMLFSqhhtmbEKk" width="480" height="271" style="" frameBorder="0" class="giphy-embed" allowFullScreen></iframe><p><a href="https://giphy.com/gifs/office-drums-desk-l0MYMLFSqhhtmbEKk">via GIPHY</a></p>

Do you remember that kid in school who used to sit at their desk and rock out with their pencils? Drum drum drum. Were you that kid? I was. Let me tell you: when I was drumming, it sounded awesome. This project is about making it sound awesome for everyone else.

What do we want to do with this app?

- You've got someone with two pencils. These are their drumsticks.
- They've got a bunch of surfaces sitting around: the desktop, a book, a water bottle, a pencil case.
- Each of these surfaces creates a different sound.

With this app, we want to process each of these sounds and map them to actual sounds from a drum kit.

So I hit the desktop and that's my snare sound. I hit the water bottle and that's my cymbal. I hit the book and that's my bass drum. When I hit them harder I get louder sounds, etc.

Here's my idea how this will work but I'm open to other ideas:

1. Training
  - I hit a surface a bunch of times
  - Model is trained to recognize each sound: I hit the book 50 times and now I have 50 samples to understand the book sound.
  - Model can also work out how hard something is being hit.
  - Train a model that can classify each sound. I get some output on how well it can do.
2. Drum kit setup
  - I map each of my sounds to each of many sounds in a drum kit or noise machine.
3. Rock out
  - I can now hit the sounds and the drum sounds play. 

Key constraints here:

1. This runs entirely in the browser. No server at all.
2. App should run in real time. Each sound is processed into an output right away.
3. We can train in the app. So if my desk setup changes, I can retrain it.

## Development

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
bun dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building

To create a production version of your app:

```sh
bun build
```

You can preview the production build with `npm run preview`.

### Recreate

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@0.12.8 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:static" devtools-json mdsvex mcp="ide:claude-code+setup:remote" storybook --install bun no2drummer
```

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
