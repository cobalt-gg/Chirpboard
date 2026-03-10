; Custom NSIS installer script for ChirpBoard

!macro customInstall
  ; Install yt-dlp via winget (silent)
  DetailPrint "Installing yt-dlp..."
  nsExec::ExecToLog 'winget install yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements'

  ; Prompt for VB-Audio Virtual Cable
  MessageBox MB_YESNO "ChirpBoard requires VB-Audio Virtual Cable for routing audio to other apps.$\n$\nWould you like to open the download page now?" IDYES install_vbcable IDNO skip_vbcable

  install_vbcable:
    DetailPrint "Opening VB-Audio Cable download page..."
    ExecShell "open" "https://vb-audio.com/Cable/index.htm"
    MessageBox MB_OK "Download and install VB-Audio Virtual Cable from the opened page.$\n$\nAfter installation, restart your computer and set it up in ChirpBoard Settings."
    Goto done_vbcable

  skip_vbcable:
    MessageBox MB_OK "You can install VB-Audio Virtual Cable later from vb-audio.com$\n$\nIt's needed to route audio to other applications like Discord or OBS."

  done_vbcable:
!macroend

!macro customUnInstall
!macroend
