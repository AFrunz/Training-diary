#!/usr/bin/env node
/**
 * Подставляет ключ подписи в сгенерированный нативный проект.
 *
 * Папка `android/` не хранится в репозитории — её создаёт `expo prebuild`,
 * а шаблон Expo подписывает релиз отладочным ключом. Такой файл ставится на
 * телефон, но Google Play его не примет, поэтому в CI ключ подкладывается
 * из секретов.
 *
 * Без переменных окружения скрипт ничего не делает и не считается ошибкой:
 * сборка «для себя» должна работать и без ключа.
 */
import { writeFileSync, readFileSync, appendFileSync, existsSync } from 'node:fs'

const GRADLE = 'android/app/build.gradle'
const PROPERTIES = 'android/gradle.properties'
const KEYSTORE = 'android/app/release.keystore'

/** Комментарий про свой ключ есть только в блоке release — по нему и целимся. */
const RELEASE_ANCHOR = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`

const RELEASE_SIGNING = `            signingConfig signingConfigs.release`

const CONFIG_ANCHOR = `    signingConfigs {`

const CONFIG_BLOCK = `    signingConfigs {
        release {
            storeFile file(RELEASE_STORE_FILE)
            storePassword RELEASE_STORE_PASSWORD
            keyAlias RELEASE_KEY_ALIAS
            keyPassword RELEASE_KEY_PASSWORD
        }`

const { ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD } =
  process.env

if (!ANDROID_KEYSTORE_BASE64) {
  console.log('Ключ подписи не задан — релиз будет подписан отладочным ключом.')
  process.exit(0)
}

for (const [name, value] of Object.entries({
  ANDROID_KEYSTORE_PASSWORD,
  ANDROID_KEY_ALIAS,
  ANDROID_KEY_PASSWORD,
})) {
  if (!value) {
    console.error(`Задан ключ, но не задано ${name}: подпись настроена наполовину.`)
    process.exit(1)
  }
}

if (!existsSync(GRADLE)) {
  console.error(`Нет ${GRADLE}: сначала нужен expo prebuild.`)
  process.exit(1)
}

writeFileSync(KEYSTORE, Buffer.from(ANDROID_KEYSTORE_BASE64, 'base64'))

appendFileSync(
  PROPERTIES,
  [
    '',
    '# подпись релиза: значения приходят из секретов сборки',
    'RELEASE_STORE_FILE=release.keystore',
    `RELEASE_KEY_ALIAS=${ANDROID_KEY_ALIAS}`,
    `RELEASE_STORE_PASSWORD=${ANDROID_KEYSTORE_PASSWORD}`,
    `RELEASE_KEY_PASSWORD=${ANDROID_KEY_PASSWORD}`,
    '',
  ].join('\n'),
)

const gradle = readFileSync(GRADLE, 'utf8')

for (const [anchor, what] of [
  [CONFIG_ANCHOR, 'блок signingConfigs'],
  [RELEASE_ANCHOR, 'подпись релиза'],
]) {
  if (!gradle.includes(anchor)) {
    console.error(`Не найден ${what} в ${GRADLE}: шаблон Expo изменился, скрипт нужно поправить.`)
    process.exit(1)
  }
}

writeFileSync(
  GRADLE,
  gradle.replace(CONFIG_ANCHOR, CONFIG_BLOCK).replace(RELEASE_ANCHOR, RELEASE_SIGNING),
)

console.log('Ключ подписи подставлен.')
