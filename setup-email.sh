#!/bin/bash

# Script de setup automático para SendGrid + Cloud Functions
# Uso: bash setup-email.sh "SG_xxxxxxxxxxxxx"

if [ -z "$1" ]; then
  echo "❌ Uso: bash setup-email.sh SG_xxxxxxxxxxxxx"
  exit 1
fi

API_KEY="$1"
PROJECT="la-sucursal-del-cafe"

echo "🔵 Paso 1: Configurando SendGrid API Key en Firebase..."
firebase functions:config:set sendgrid.api_key="$API_KEY" --project "$PROJECT" 2>&1 | tail -3

if [ $? -ne 0 ]; then
  echo "❌ Error configurando Firebase. ¿Estás logueado?"
  echo "   Ejecuta: firebase login"
  exit 1
fi

echo ""
echo "🟠 Paso 2: Instalando paquete SendGrid en Cloud Functions..."
cd functions
npm install --save @sendgrid/mail 2>&1 | grep -E "added|up to date"
cd ..

echo ""
echo "🟡 Paso 3: Desplegando Cloud Functions a Firebase..."
firebase deploy --only functions --project "$PROJECT" 2>&1 | grep -E "Deploy complete|Function URL|Error"

echo ""
echo "✅ Setup completado. Probando configuración..."
firebase functions:config:get --project "$PROJECT" | grep sendgrid

echo ""
echo "🟢 LISTO PARA TESTEAR:"
echo "   1. Abre: https://la-sucursal-del-cafe.web.app/registro-fidelizacion"
echo "   2. Registra un cliente de prueba con TU EMAIL"
echo "   3. En ~10 segundos deberías recibir el email con QR"
echo ""
echo "¿Dudas? Ver: EMAIL-TAREAS-DIVISION.md"
