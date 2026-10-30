# Building the finance installer

The Windows x64 installer includes the readable app source and a checksum-verified Node.js runtime. It installs for the current user, creates desktop and Start menu shortcuts, and keeps financial data outside the replaceable application files. Uninstall retains that data. Published builds are unsigned.

From the repository root, with Python and the Inno Setup compiler installed:

```powershell
./tools/build-finance-installer.ps1 -CompilerPath 'C:/path/to/ISCC.exe' -WorkDirectory 'C:/new/staging-folder' -OutputDirectory 'C:/new/output-folder'
./products/finance-workspace/installer/test-install.ps1 -InstallerPath 'C:/new/output-folder/Your-Finances-Setup-1.1.1-x64.exe' -TestRoot 'C:/new/test-folder'
```

The test requires an account with no existing Your finances installation or shortcuts. It uses an isolated data directory and verifies installation, shortcut startup, active upgrade, uninstall and reinstall. It preserves its synthetic test data and logs for review.

The builder packages the allowlisted source ZIP, verifies official Node archive and executable hashes, includes Node's license, and writes an installer checksum and build manifest. The Windows CI workflow runs the same build and lifecycle test. Review the exact installer and its manifest before publishing a release; do not upload a locally modified runtime or private records.

After changing product source, regenerate the source ZIP and rebuild the installer together. Update the release version and download links for a new release. Publish the tested EXE, its checksum, and manifest as GitHub release assets. The full source ZIP remains available separately on the software site.

For a version upgrade test, pass `-PreviousInstallerPath` pointing to the published 1.0.0 installer. The test first installs that build, saves fictional data, then upgrades the active installation to the candidate. It uses an isolated data directory and refuses existing user installation/shortcuts.
