#!/usr/bin/env node
import { readFileSync } from 'node:fs'

/**
 * Пересказ отчёта Jest для сводки прогона.
 *
 * Логи GitHub Actions скачиваются только с токеном, а сводка job'а видна и
 * снаружи. Поэтому упавшие тесты выписываются сюда: по красному прогону сразу
 * видно, что именно сломалось, без доступа к логам.
 */

const [, , reportPath] = process.argv

const print = (line = '') => process.stdout.write(`${line}\n`)

let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch (error) {
  print(`### Отчёт Jest не прочитан\n\nФайл \`${reportPath}\`: ${error.message}`)
  process.exit(0)
}

const failed = (report.testResults ?? []).flatMap((suite) =>
  (suite.assertionResults ?? [])
    .filter((test) => test.status === 'failed')
    .map((test) => ({
      file: (suite.name ?? '').split('/src/')[1] ?? suite.name,
      title: [...(test.ancestorTitles ?? []), test.title].join(' › '),
      message: (test.failureMessages ?? []).join('\n'),
    })),
)

print(`### Тесты: ${report.numFailedTests ?? 0} из ${report.numTotalTests ?? 0} упали`)
print()

if (failed.length === 0) {
  // набор может упасть и целиком — например, на ошибке импорта
  const broken = (report.testResults ?? []).filter((suite) => suite.status === 'failed')
  for (const suite of broken) {
    print(`**${suite.name}**`)
    print('```')
    print((suite.message ?? '').trim().slice(0, 2000))
    print('```')
  }
  process.exit(0)
}

for (const test of failed) {
  print(`**${test.title}**  \n\`${test.file}\``)
  print('```')
  // целиком сообщения с цветовыми кодами в сводку не помещаются
  print(test.message.replaceAll(/\u001b\[\d+m/g, '').trim().slice(0, 1500))
  print('```')
  print()
}
