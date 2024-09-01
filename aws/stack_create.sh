
#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

aws --region us-east-1 cloudformation create-stack \
  --stack-name behave-claude-apps-com \
  --template-body "file://${SCRIPT_DIR}/stack.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameters \
    ParameterKey=HostedZoneName,ParameterValue=claude-apps.com \
    ParameterKey=HostedZoneId,ParameterValue=Z0033081161IG00XGJDLG \
    ParameterKey=Hostname,ParameterValue=behave \
    ParameterKey=PriceClass,ParameterValue=PriceClass_All \
    ParameterKey=GitHubOrg,ParameterValue=behave-app \
    ParameterKey=RepositoryName,ParameterValue=behave
