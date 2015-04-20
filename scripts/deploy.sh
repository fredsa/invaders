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


GIT_CLEAN_VERSION=$(git log -1 --pretty=format:%H)
GIT_VERSION="$GIT_CLEAN_VERSION"
if [ -n "$(git status --porcelain)" ]
then
  GIT_VERSION="dirty-$GIT_CLEAN_VERSION"
fi


function get_project() {
  local project
  project=$(gcloud config list project --format text | sed 's/^core.project: *//')

  while [ $# -gt 0 ]
  do
    if [ "$1" == "--project" ]
    then
      shift
      project=$1
    elif [ "${1/=*/}" == "--project" ]
    then
      project=${1/--project=/}
    fi
    shift
  done
  echo $project
}

function get_version() {
  local version
  version="$GIT_VERSION"

  while [ $# -gt 0 ]
  do
    if [ "$1" == "--version" ]
    then
      shift
      version=$1
    elif [ "${1/=*/}" == "--version" ]
    then
      version=${1/--version=/}
    fi
    shift
  done
  echo $version
}


SCRIPTS_DIR=$( dirname $0 )
ROOT_DIR=$( dirname $SCRIPTS_DIR )

VERSION=$(get_version $*)
PROJECT=$(get_project $*)


echo -e "\n*** CHECKING GIT STATUS ***\n"
git status

if [ "$VERSION" == "$GIT_CLEAN_VERSION" ]
then
  echo
  echo -e "Hit [ENTER] to continue: \c"
  read
fi


echo
echo "$ gcloud config list"
gcloud config list

echo
echo "USING:"
echo " - project: $PROJECT"
echo " - version: $VERSION"

echo
echo "Deployed versions can be managed from the Developer Console:"
echo
echo "  https://console.developers.google.com/project/${PROJECT}/appengine/versions"


echo -e "\n*** CANCELLING ANY PENDING DEPLOYMENTS (just in case) ***\n"
gcloud preview app modules cancel-deployment --version $VERSION default $*


echo -e "\n*** DEPLOYING ***\n"
gcloud preview app deploy --version $VERSION $* .


echo -e "\n*** ARE WE THERE YET? ***\n"
if [ "$VERSION" == "$GIT_CLEAN_VERSION" ]
then
  echo "To change the default version, please run:"
  echo
  echo "  gcloud preview app modules set-default --version $VERSION default $*"
  echo
else
  echo "WARNING: Default version update notification skipped due to version '$VERSION' != '$GIT_CLEAN_VERSION'"
  echo
fi
