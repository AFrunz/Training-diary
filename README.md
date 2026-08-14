# 🏋️ Training Diary

[![Tests](https://github.com/AFrunz/Training-diary/actions/workflows/tests.yml/badge.svg)](https://github.com/AFrunz/Training-diary/actions/workflows/tests.yml)
[![Android build](https://github.com/AFrunz/Training-diary/actions/workflows/release.yml/badge.svg)](https://github.com/AFrunz/Training-diary/actions/workflows/release.yml)
[![License MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An offline strength-training diary for Android. No accounts, no server, no internet access — everything lives on the device and moves between phones as a single file.

[Русский](README.ru.md) · [Requirements](TZ.md) · [Architecture](ARCHITECTURE.md) · [Building and releasing](RELEASE.md)

> Requirements, architecture and release notes are written in Russian.

## Why

To track how working weights grow for every exercise, and to see your consistency honestly: planned time off is not the same as a skipped week, so a vacation does not ruin the stats.

## Features

- **Calendar**, monthly and yearly: a training day is marked with its program colour, time off is greyed out
- **Workout screen** with a live timer, sets and completion checkmarks; weight is optional — for pull-ups and planks
- **Programs** — training days with free-form names, their own colour and exercise list
- **Library** of 40 preloaded exercises with search and grouping by muscle
- **Exercise history**: records, a weight progression chart, sets broken down with the delta since last time
- **Statistics** for a month or a year: consistency, average duration, completion rate, week streaks
- **Your data stays yours**: export and import as one file, rotating auto-backups, full wipe
- Russian and English, light and dark themes, kilograms and pounds

## How it is built

Layered architecture with dependency inversion — details in [ARCHITECTURE.md](ARCHITECTURE.md).

```
ui/      screens, theming, i18n            → knows app and domain types
app/     use cases and ports               → knows domain
domain/  calculation rules, zero imports   → knows nobody
infra/   SQLite, files, clock              → implements app ports
```

Calculation rules know nothing about React Native or the database, so they run as plain tests in seconds. Ports let component tests exercise real use cases on top of in-memory storage — no emulator, no SQLite.

**Stack:** Expo · React Native · TypeScript · expo-router · SQLite via Drizzle · TanStack Query

## Tests

625 tests across four levels plus 12 end-to-end Maestro flows:

```sh
npm test              # everything
npm run typecheck     # types
maestro test e2e/     # end-to-end, needs an emulator
```

| Level | What replaces the environment |
| --- | --- |
| calculation rules | nothing |
| use cases | in-memory ports |
| data layer | in-memory SQLite |
| interface | use-case container over ports |

## Running it

```sh
npm install
npx expo start        # then scan the QR code with Expo Go
```

An installable APK is built automatically when a release is published — see [RELEASE.md](RELEASE.md).

## Design

Mockups live in `design.pen` ([Pencil](https://pen.dev)): 13 screens in light and dark themes, a design system with tokens, the app icon and an inventory of interface icons.

## License

[MIT](LICENSE)
