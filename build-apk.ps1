# Build DevSuite Pro APK without Gradle.
# Requires: JDK 17 (toolchain\jdk) and Android SDK build-tools 35 + platform android-35.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$jdk = Join-Path $root 'toolchain\jdk\jdk-17.0.21+9'
$sdk = Join-Path $root 'toolchain\android-sdk'
$buildTools = Join-Path $sdk 'build-tools\35.0.0'
$androidJar = Join-Path $sdk 'platforms\android-35\android.jar'
$aapt2 = Join-Path $buildTools 'aapt2.exe'
$zipalign = Join-Path $buildTools 'zipalign.exe'
$apksigner = Join-Path $buildTools 'apksigner.bat'
$d8 = Join-Path $buildTools 'd8.bat'
$javac = Join-Path $jdk 'bin\javac.exe'
$keytool = Join-Path $jdk 'bin\keytool.exe'

$env:JAVA_HOME = $jdk
$env:PATH = (Join-Path $jdk 'bin') + ';' + $env:PATH

foreach ($p in @($aapt2, $zipalign, $apksigner, $d8, $javac, $keytool, $androidJar)) {
    if (-not (Test-Path $p)) { throw "Не найден компонент сборки: $p" }
}

$android = Join-Path $root 'android'
$build = Join-Path $android 'build'
$assets = Join-Path $android 'assets'
$out = Join-Path $root 'dist'

if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Path $build | Out-Null
New-Item -ItemType Directory -Path (Join-Path $build 'gen') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $build 'classes') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $build 'dex') | Out-Null
New-Item -ItemType Directory -Path $out -Force | Out-Null

if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }
New-Item -ItemType Directory -Path $assets | Out-Null
Copy-Item (Join-Path $root 'app\*') $assets -Recurse -Force
Write-Host 'Assets copied:' (Get-ChildItem $assets -Recurse -File | Measure-Object).Count 'files'

Write-Host '== aapt2 compile =='
& $aapt2 compile --dir (Join-Path $android 'res') -o (Join-Path $build 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

Write-Host '== aapt2 link =='
& $aapt2 link -o (Join-Path $build 'app-unsigned.apk') -I $androidJar --manifest (Join-Path $android 'AndroidManifest.xml') -R (Join-Path $build 'res.zip') --java (Join-Path $build 'gen') -A $assets --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

Write-Host '== javac =='
$javaFiles = @()
$javaFiles += (Get-ChildItem (Join-Path $build 'gen') -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$javaFiles += (Get-ChildItem (Join-Path $android 'src') -Recurse -Filter *.java | ForEach-Object { $_.FullName })
& $javac -source 8 -target 8 -encoding UTF-8 -bootclasspath $androidJar -classpath $androidJar -d (Join-Path $build 'classes') $javaFiles
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

Write-Host '== d8 =='
$classFiles = @(Get-ChildItem (Join-Path $build 'classes') -Recurse -Filter *.class | ForEach-Object { $_.FullName })
& $d8 --lib $androidJar --min-api 24 --output (Join-Path $build 'dex') $classFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }
if (-not (Test-Path (Join-Path $build 'dex\classes.dex'))) { throw 'classes.dex not produced' }

Write-Host '== package classes.dex =='
$py = @'
import zipfile, sys
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
print('classes.dex added')
'@
$pyPath = Join-Path $build 'adddex.py'
Set-Content -Path $pyPath -Value $py -Encoding UTF8
python $pyPath (Join-Path $build 'app-unsigned.apk') (Join-Path $build 'dex\classes.dex')
if ($LASTEXITCODE -ne 0) { throw 'failed to add classes.dex' }

Write-Host '== zipalign =='
& $zipalign -f 4 (Join-Path $build 'app-unsigned.apk') (Join-Path $build 'app-aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

$keystore = Join-Path $android 'devsuite.keystore'
if (-not (Test-Path $keystore)) {
    Write-Host '== generate keystore =='
    & $keytool -genkeypair -v -keystore $keystore -storetype JKS -alias devsuite -keyalg RSA -keysize 2048 -validity 10000 -storepass devsuite2026 -keypass devsuite2026 -dname "CN=DevSuite Pro, OU=Apps, O=DevSuite, L=Moscow, C=RU"
    if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
}

Write-Host '== apksigner =='
$final = Join-Path $out 'DevSuitePro-1.0.0.apk'
& $apksigner sign --ks $keystore --ks-key-alias devsuite --ks-pass pass:devsuite2026 --key-pass pass:devsuite2026 --out $final (Join-Path $build 'app-aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'apksigner sign failed' }

Write-Host '== verify =='
& $apksigner verify --print-certs $final
& $aapt2 dump badging $final | Select-Object -First 8

Write-Host ''
Write-Host "APK готов: $final"
Get-Item $final | Select-Object FullName, Length | Format-List
