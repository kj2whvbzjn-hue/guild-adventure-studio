# Build 472.30.2 Benchmark Generator Negative QA

## Base
- Stable base: Build 472.30.1

## Added
- `Benchmark異常生成を確認（QA）` button.
- Shared pre-generation validation for the normal Benchmark sample generator.
- Deliberately broken Benchmark reference (`BOS-DOES-NOT-EXIST`) for negative QA.

## Expected behavior
- Normal button: creates the Benchmark QA ZIP.
- QA abnormal button: creates no ZIP and displays a dialog containing the detected cause.

## Adoption rule
After both normal and abnormal tests pass on device, re-upload Build 472.30.1 as the stable deployment. Build 472.30.2 remains a QA build.
