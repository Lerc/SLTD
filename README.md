# SLTD · Simple Little Tower Defence

A tower defence game for phones and browsers, written in plain JavaScript with
Canvas and WebGL. It has no build step and no runtime dependencies.

## Web version

Serve the `srv/` directory with any static web server. For example:

```sh
python3 -m http.server 8000 --directory srv
```

Then open http://localhost:8000.

## Android version

Building needs JDK 17 or 21 and an Android SDK with platform `android-35` and
build tools `35.0.0`. Set `ANDROID_HOME` to the SDK, then:

```sh
cd android
./gradlew --no-daemon :app:assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
[android/README.md](android/README.md) covers release builds and signing.
