#!/bin/bash

# Test script to diagnose patient binding issues
# This script tests the full flow: create session -> bind patient -> fetch session

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8000}"
TOKEN="${TOKEN:-}"
TEMPLATE_ID="${TEMPLATE_ID:-650e8400-e29b-41d4-a716-446655440001}"
PATIENT_ID="${PATIENT_ID:-750e8400-e29b-41d4-a716-446655440002}"

echo "🔍 Patient Binding Diagnostic Test"
echo "===================================="
echo ""
echo "Configuration:"
echo "  API URL: $API_URL"
echo "  Template ID: $TEMPLATE_ID"
echo "  Patient ID: $PATIENT_ID"
echo ""

if [ -z "$TOKEN" ]; then
  echo "⚠️  WARNING: TOKEN not set. Set TOKEN environment variable for authenticated requests."
  echo "  Example: export TOKEN='your_jwt_token'"
  echo ""
fi

# Prepare headers
HEADERS="-H 'Content-Type: application/json'"
if [ -n "$TOKEN" ]; then
  HEADERS="$HEADERS -H 'Authorization: Bearer $TOKEN'"
fi

# Step 1: Create Session
echo "📝 Step 1: Create Session"
echo "------------------------"
echo "POST $API_URL/api/sessions"
echo "Body: {\"templateId\": \"$TEMPLATE_ID\"}"
echo ""

SESSION_RESPONSE=$(curl -s -X POST "$API_URL/api/sessions" \
  $HEADERS \
  -d "{\"templateId\": \"$TEMPLATE_ID\"}")

echo "Response:"
echo "$SESSION_RESPONSE" | jq . 2>/dev/null || echo "$SESSION_RESPONSE"
echo ""

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId // .session_id // empty' 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
  echo "❌ ERROR: Failed to create session. Cannot continue."
  exit 1
fi

echo "✅ Session created: $SESSION_ID"
echo ""

# Step 2: Fetch Initial Session State
echo "🔍 Step 2: Fetch Initial Session (Before Binding)"
echo "-------------------------------------------------"
echo "GET $API_URL/api/sessions/$SESSION_ID"
echo ""

INITIAL_RESPONSE=$(curl -s -X GET "$API_URL/api/sessions/$SESSION_ID" $HEADERS)

echo "Response:"
echo "$INITIAL_RESPONSE" | jq . 2>/dev/null || echo "$INITIAL_RESPONSE"
echo ""

INITIAL_PATIENT=$(echo "$INITIAL_RESPONSE" | jq -r '.patient // empty' 2>/dev/null)
INITIAL_PATIENT_ID=$(echo "$INITIAL_RESPONSE" | jq -r '.patientId // empty' 2>/dev/null)

echo "Initial State:"
echo "  patientId field: ${INITIAL_PATIENT_ID:-'null'}"
echo "  patient object: ${INITIAL_PATIENT:-'null'}"
echo ""

# Step 3: Bind Patient
echo "🔗 Step 3: Bind Patient to Session"
echo "----------------------------------"
echo "POST $API_URL/api/sessions/$SESSION_ID/patient"
echo "Body: {\"patientId\": \"$PATIENT_ID\"}"
echo ""

BIND_RESPONSE=$(curl -s -X POST "$API_URL/api/sessions/$SESSION_ID/patient" \
  $HEADERS \
  -d "{\"patientId\": \"$PATIENT_ID\"}")

echo "Response:"
echo "$BIND_RESPONSE" | jq . 2>/dev/null || echo "$BIND_RESPONSE"
echo ""

BIND_SUCCESS=$(echo "$BIND_RESPONSE" | jq -r '.success // empty' 2>/dev/null)

if [ "$BIND_SUCCESS" != "true" ]; then
  echo "⚠️  WARNING: Binding response did not indicate success. Check response above."
fi

echo "✅ Patient binding request completed"
echo ""

# Step 4: Wait a moment for database consistency
echo "⏳ Waiting 2 seconds for database consistency..."
sleep 2
echo ""

# Step 5: Fetch Session After Binding
echo "🔍 Step 5: Fetch Session (After Binding)"
echo "--------------------------------------"
echo "GET $API_URL/api/sessions/$SESSION_ID"
echo ""

AFTER_RESPONSE=$(curl -s -X GET "$API_URL/api/sessions/$SESSION_ID" $HEADERS)

echo "Response:"
echo "$AFTER_RESPONSE" | jq . 2>/dev/null || echo "$AFTER_RESPONSE"
echo ""

AFTER_PATIENT=$(echo "$AFTER_RESPONSE" | jq -r '.patient // empty' 2>/dev/null)
AFTER_PATIENT_ID=$(echo "$AFTER_RESPONSE" | jq -r '.patientId // empty' 2>/dev/null)

echo "After Binding State:"
echo "  patientId field: ${AFTER_PATIENT_ID:-'null'}"
echo "  patient object: ${AFTER_PATIENT:-'null'}"
echo ""

# Step 6: Analysis
echo "📊 Analysis"
echo "-----------"
echo ""

if [ "$AFTER_PATIENT_ID" = "$PATIENT_ID" ]; then
  echo "✅ patientId field correctly set in response"
else
  echo "❌ patientId field NOT set or incorrect"
  echo "   Expected: $PATIENT_ID"
  echo "   Got: ${AFTER_PATIENT_ID:-'null'}"
fi

echo ""

if [ "$AFTER_PATIENT" != "null" ] && [ -n "$AFTER_PATIENT" ]; then
  echo "✅ patient object populated in response"
  echo "   Patient data:"
  echo "$AFTER_RESPONSE" | jq '.patient' 2>/dev/null || echo "   (Could not parse patient object)"
else
  echo "❌ patient object NOT populated in response"
fi

echo ""

# Final Summary
echo "🎯 Summary"
echo "----------"

if [ "$AFTER_PATIENT_ID" = "$PATIENT_ID" ] && [ "$AFTER_PATIENT" != "null" ]; then
  echo "✅ SUCCESS: Patient binding is working correctly!"
  exit 0
elif [ "$AFTER_PATIENT_ID" = "$PATIENT_ID" ]; then
  echo "⚠️  PARTIAL: patientId is set but patient object is empty"
  echo "   Backend may need to populate patient via JOIN"
  exit 1
else
  echo "❌ FAILURE: Patient binding is not persisting"
  echo "   The backend is not storing the patientId relationship"
  exit 1
fi
