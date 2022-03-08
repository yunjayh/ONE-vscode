/*
 * Copyright (c) 2022 Samsung Electronics Co., Ltd. All Rights Reserved
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {readFileSync, writeFileSync} from 'fs';
import {EOL} from 'os';

import * as licenseJudgment from './license-judgment.json';
import * as packageJudgment from './package-judgment.json';


/**
 * Argument List
 *  - Input path for list of used licenses
 *  - Tag name for the verification
 */
var args = process.argv.slice(2)
const inputPathOfLicenseList = args[0];
const verificationTag = args[1];

/**
 * - WarningCount : The total number of warnings
 *
 * - WarnnedLicenseUsed
 *   - Licenses which are classified as WARN in license-judgment.json
 *   - These licenses should be verified manually according to each criteria
 *     and the package should be added to package-judgment.json
 * - NeverChecked
 *   - Licenses which are not found in license-judgment.json
 *   - These licenses should be added license-judgment.json
 * - UnknownLicense
 *   - Licenses of package are not found.
 *   - These packages should be manually checked and added to package-judgment.json
 */
var warningList = {
  'WarningCount': 0,

  'WarnedLicenseUsed': [] as string[],
  'NeverChecked': [] as string[],
  'UnknownLicense': [] as string[]
};

/**
 * - DeniedCount : The total number of denials
 *
 * - ONEForbidden
 *   - License which are forbidden in ONE
 * - DeniedLicenseUsed
 *   - License which are blocked by license-judgment.json
 */
var deniedList = {
  'DeniedCount': 0,

  'ONEForbidden': [] as string[],
  'DeniedLicenseUsed': [] as string[]
};

/**
 * Verification start
 */
const usedLicenseList = JSON.parse(readFileSync(inputPathOfLicenseList, 'utf-8'));
for (const pkg in usedLicenseList) {
  var pkgInfo = usedLicenseList[pkg];
  if (packageJudgment.hasOwnProperty(pkg)) {
    const pkgKey = pkg as keyof typeof packageJudgment;

    if (packageJudgment[pkgKey].ONE_permitted == 'no') {
      deniedList.DeniedCount++;
      deniedList.ONEForbidden.push(pkg + EOL);
    } else if (packageJudgment[pkgKey].ONE_permitted == 'yes') {
      // Do nothing
    } else if (packageJudgment[pkgKey].ONE_permitted == 'conditional') {
      // Only check when release
    } else {
      throw new Error('Not implemented permission type');
    }
  } else if (licenseJudgment.Denied.includes(pkgInfo.licenses)) {
    deniedList.DeniedCount++;
    deniedList.DeniedLicenseUsed.push(pkg + ' : ' + pkgInfo.licenses + EOL);
  } else if (licenseJudgment.Warning.includes(pkgInfo.licenses)) {
    warningList.WarningCount++;
    warningList.WarnedLicenseUsed.push(pkg + ' : ' + pkgInfo.licenses + EOL);
  } else if (licenseJudgment.Allowed.includes(pkgInfo.licenses)) {
    // Do Nothing
  } else if (pkgInfo.licenses == 'UNKNOWN') {
    warningList.WarningCount++;
    warningList.UnknownLicense.push(pkg + EOL);
  } else {
    warningList.WarningCount++;
    warningList.NeverChecked.push(pkg + ' : ' + pkgInfo.licenses + EOL);
  }
}

/**
 * Report Generation
 */
var resultMsg = '#### ' + verificationTag + EOL + EOL;
var issueFound = false;

if (warningList.WarningCount > 0) {
  issueFound = true;
  resultMsg += (':warning: **Warning** :warning:' + EOL);

  if (warningList.NeverChecked.length > 0) {
    resultMsg += ('- Following licenses are never checked' + EOL);
    warningList.NeverChecked.forEach(msg => {
      resultMsg += ('    - ' + msg);
    });
  }
  if (warningList.WarnedLicenseUsed.length > 0) {
    resultMsg += ('- Further verification is needed for following licenses' + EOL);
    warningList.WarnedLicenseUsed.forEach(msg => {
      resultMsg += ('    - ' + msg);
    });
  }
  if (warningList.UnknownLicense.length > 0) {
    resultMsg += ('- License is not found for following packages' + EOL);
    warningList.UnknownLicense.forEach(msg => {
      resultMsg += ('    - ' + msg);
    });
  }

  resultMsg += EOL;
}

if (deniedList.DeniedCount > 0) {
  issueFound = true;
  resultMsg += (':no_entry: **Denied** :no_entry:' + EOL);

  if (deniedList.ONEForbidden.length > 0) {
    resultMsg += ('- Following packages are forbidden in ONE' + EOL);
    deniedList.ONEForbidden.forEach(msg => {
      resultMsg += ('    - ' + msg);
    });
  }
  if (deniedList.DeniedLicenseUsed.length > 0) {
    resultMsg += ('- Following packages use denied licenses' + EOL);
    deniedList.DeniedLicenseUsed.forEach(msg => {
      resultMsg += ('    - ' + msg);
    });
  }

  resultMsg += EOL;
}

if (issueFound == false) {
  resultMsg += (':heavy_check_mark: No license issue found' + EOL);
}

var resultZip = {
  'resultMsg': resultMsg,
  'warnCount': warningList.WarningCount.toString(),
  'denialCount': deniedList.DeniedCount.toString()
};
writeFileSync(verificationTag + '.json', JSON.stringify(resultZip));
