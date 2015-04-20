#!/bin/bash
#
set -ue

(gcloud -v >/dev/null \
&& gcloud preview app --help >/dev/null) \
|| (cat <<-EOD

  ERROR: Please setup your environment first using this command:

  $ scripts/install.sh

EOD
exit 1) || exit $?


gcloud preview app run \
  --host localhost \
  --admin-host localhost \
  . $*
