# VOYNANN Motion — project starter

Created by Claude from the voynann-motion skill. Remotion 4 + React Three Fiber; 9:16.

```bash
npm ci                 # install (once)
npm run check-env      # what this computer has
npm run smoke          # proves 3D rendering works → out/smoke/_sheet.jpg
npm run dev            # Remotion Studio
npm run vo -- public/audio/vo.mp3                    # voice-over timing
npm run stills -- out/qa 0.5s,3s,6s <Composition>    # QA stills
npm run render:final -- --comp=<FinalComposition> --out=out/final.mp4 --vo=public/audio/vo.mp3 --offset=0.4
```

`src/core` is the shared VOYNANN library (see the skill's `references/production-kit.md`).
`src/scenes/showcase` is only an environment check — films live in their own folders.

CHARACTER FLOW projects (`--kit=characterflow`) add `src/kits/characterflow`, `src/stories` and:
`node scripts/transcribe.mjs <vo> --id=<id>` · `node scripts/make.mjs stories/<id>/story.json [--stills=…|--final]`.
