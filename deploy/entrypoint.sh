#!/bin/sh
set -eu
workspace_token=${WW_ADMIN_TOKEN:-}
if [ "${#workspace_token}" -lt 16 ] || [ -z "${WW_ORIGIN:-}" ]; then
  echo 'Set WW_ADMIN_TOKEN (at least 16 characters) and WW_ORIGIN before starting.' >&2
  exit 1
fi
mkdir -p /data
chown wine:wine /data
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/workspace.conf
