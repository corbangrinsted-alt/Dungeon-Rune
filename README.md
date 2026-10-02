# Dungeon Rune

## Run the desktop app locally

Install Node.js 22 or newer, then run:

```sh
npm install
npm start
```

## Publish downloadable builds

Push this project to a GitHub repository, then create and push a version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions builds a Windows installer, a macOS disk image, and a Linux AppImage, then attaches them to a GitHub Release. Players download the installer for their computer from the repository's **Releases** page; they do not need VS Code or Node.js.

For each update, increment the `version` in `package.json`, commit the change, and push a matching new tag such as `v0.1.1`. Players download the new release manually; automatic in-app updates are not configured.

macOS builds are not signed or notarized by default, so macOS may warn players when they first open the download. Signing and notarization require an Apple Developer account.
