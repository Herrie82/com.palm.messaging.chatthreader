#!/bin/bash
# stage.sh — package the WHOLE com.palm.messaging.chatthreader service as its own ipk. This repo
# is the single source of truth (confirmed byte-identical to the live on-device service across
# every file that differs from the StockRootfs reference snapshot -- that snapshot simply predates
# a few of these files); postinst replaces /usr/palm/services/com.palm.messaging.chatthreader
# wholesale (backing up stock first).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO" /usr/palm/services/com.palm.messaging.chatthreader com.palm.messaging.chatthreader \
  packaging watches

echo "com.palm.messaging.chatthreader stage complete: $STAGE"
