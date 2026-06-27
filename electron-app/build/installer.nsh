!macro customInstall
  DetailPrint "Instalando certificado de firma FlowDashboard en Entidades de certificacion raiz de confianza (usuario actual)..."
  IfFileExists "$INSTDIR\resources\flowdashboard-codesign.cer" 0 skipCert
  nsExec::ExecToLog 'certutil.exe -addstore -user -f root "$INSTDIR\resources\flowdashboard-codesign.cer"'
  Pop $0
  DetailPrint "certutil addstore resultado: $0"
  skipCert:
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'certutil.exe -delstore -user root "FlowDashboard"'
  Pop $0
  DetailPrint "certutil delstore resultado: $0"
!macroend
