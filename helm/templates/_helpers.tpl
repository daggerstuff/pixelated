{{- define "pixelated-empathy.fullname" -}}
{{- printf "%s" .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pixelated-empathy.name" -}}
{{- .Chart.Name -}}
{{- end -}}
