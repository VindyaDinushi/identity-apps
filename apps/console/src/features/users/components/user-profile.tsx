/**
 * Copyright (c) 2020, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License
 */

import { ProfileConstants } from "@wso2is/core/constants";
import { hasRequiredScopes } from "@wso2is/core/helpers";
import {
    AlertInterface,
    AlertLevels,
    ProfileInfoInterface,
    ProfileSchemaInterface,
    SBACInterface,
    TestableComponentInterface
} from "@wso2is/core/models";
import { addAlert } from "@wso2is/core/store";
import { CommonUtils, ProfileUtils } from "@wso2is/core/utils";
import { Field, Forms, Validation } from "@wso2is/forms";
import {
    ConfirmationModal,
    ContentLoader,
    DangerZone,
    DangerZoneGroup,
    EmphasizedSegment,
    useConfirmationModalAlert
} from "@wso2is/react-components";
import { AxiosError } from "axios";
import isEmpty from "lodash-es/isEmpty";
import React, { FunctionComponent, ReactElement, ReactNode, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Button, CheckboxProps, Divider, DropdownItemProps, Form, Grid, Icon, Input } from "semantic-ui-react";
import { ChangePasswordComponent } from "./user-change-password";
import { SCIMConfigs } from "../../../extensions/configs/scim";
import { AppConstants, AppState, FeatureConfigInterface, history } from "../../core";
import { ConnectorPropertyInterface, ServerConfigurationsConstants  } from "../../server-configurations";
import { getUserDetails, updateUserInfo } from "../api";
import { UserManagementConstants } from "../constants";
import { commonConfig,userConfig } from "../../../extensions";
/**
 * Prop types for the basic details component.
 */
interface UserProfilePropsInterface extends TestableComponentInterface, SBACInterface<FeatureConfigInterface> {
    /**
     * On alert fired callback.
     */
    onAlertFired: (alert: AlertInterface) => void;
    /**
     * User profile
     */
    user: ProfileInfoInterface;
    /**
     * Handle user update callback.
     */
    handleUserUpdate: (userId: string) => void;
    /**
     * Show if the user is read only.
     */
    isReadOnly?: boolean;
    /**
     * Allow if the user is deletable.
     */
    allowDeleteOnly?: boolean;
    /**
     * Password reset connector properties
     */
    connectorProperties: ConnectorPropertyInterface[];
    /**
     * Is read only user stores loading.
     */
    isReadOnlyUserStoresLoading?: boolean;
    /**
     * Tenant admin
     */
    tenantAdmin?: string;
    /**
     * User Disclaimer Message
     */
    editUserDisclaimerMessage?: ReactNode;
}

/**
 * Basic details component.
 *
 * @param {UserProfilePropsInterface} props - Props injected to the basic details component.
 * @return {ReactElement}
 */
export const UserProfile: FunctionComponent<UserProfilePropsInterface> = (
    props: UserProfilePropsInterface
): ReactElement => {

    const {
        onAlertFired,
        user,
        handleUserUpdate,
        isReadOnly,
        allowDeleteOnly,
        featureConfig,
        connectorProperties,
        isReadOnlyUserStoresLoading,
        tenantAdmin,
        editUserDisclaimerMessage,
        [ "data-testid" ]: testId
    } = props;

    const { t } = useTranslation();

    const dispatch = useDispatch();

    const profileSchemas: ProfileSchemaInterface[] = useSelector((state: AppState) => state.profile.profileSchemas);
    const allowedScopes: string = useSelector((state: AppState) => state?.auth?.scope);
    const authenticatedUser: string = useSelector((state: AppState) => state?.auth?.username);

    const [ profileInfo, setProfileInfo ] = useState(new Map<string, string>());
    const [ profileSchema, setProfileSchema ] = useState<ProfileSchemaInterface[]>();
    const [ showDeleteConfirmationModal, setShowDeleteConfirmationModal ] = useState<boolean>(false);
    const [ deletingUser, setDeletingUser ] = useState<ProfileInfoInterface>(undefined);
    const [ editingAttribute, setEditingAttribute ] = useState(undefined);
    const [ showDisableConfirmationModal, setShowDisableConfirmationModal ] = useState<boolean>(false);
    const [ showLockConfirmationModal, setShowLockConfirmationModal ] = useState<boolean>(false);
    const [ openChangePasswordModal, setOpenChangePasswordModal ] = useState<boolean>(false);
    const [ configSettings, setConfigSettings ] = useState({
        accountDisable: "false",
        accountLock: "false",
        forcePasswordReset: "false"
    });
    const [ forcePasswordTriggered, setForcePasswordTriggered ] = useState<boolean>(false);
    const [ accountLock, setAccountLock ] = useState<string>(undefined);
    const [ accountDisable, setAccountDisable ] = useState<string>(undefined);
    const [ oneTimePassword, setOneTimePassword ] = useState<string>(undefined);
    const [ alert, setAlert, alertComponent ] = useConfirmationModalAlert();
    const [ countryList, setCountryList ] = useState<DropdownItemProps[]>([]);

    useEffect(() => {

        if (connectorProperties && Array.isArray(connectorProperties) && connectorProperties?.length > 0) {

            let configurationStatuses = { ...configSettings } ;

             for (const property of connectorProperties) {
                if (property.name === ServerConfigurationsConstants.ACCOUNT_DISABLING_ENABLE) {
                    configurationStatuses = {
                        ...configurationStatuses,
                        accountDisable: property.value
                    };
                } else if (property.name === ServerConfigurationsConstants.RECOVERY_LINK_PASSWORD_RESET
                    || property.name === ServerConfigurationsConstants.OTP_PASSWORD_RESET
                    || property.name === ServerConfigurationsConstants.OFFLINE_PASSWORD_RESET) {

                    if(property.value === "true") {
                        configurationStatuses = {
                            ...configurationStatuses,
                            forcePasswordReset: property.value
                        };
                    }
                } else if (property.name === ServerConfigurationsConstants.ACCOUNT_LOCK_ON_CREATION) {
                    configurationStatuses = {
                        ...configurationStatuses,
                        accountLock: property.value
                    };
                }
            }

            setConfigSettings(configurationStatuses);
        }
    }, [ connectorProperties ]);

    useEffect(() => {
        if (user?.id === undefined) {
            return;
        }

        const attributes = UserManagementConstants.SCIM2_ATTRIBUTES_DICTIONARY.get("ONETIME_PASSWORD");

        getUserDetails(user?.id, attributes)
            .then((response) => {
                setOneTimePassword(response[ProfileConstants.SCIM2_ENT_USER_SCHEMA]?.oneTimePassword);
            });
    }, [ forcePasswordTriggered ]);

    useEffect(() => {
        if (user?.id === undefined) {
            return;
        }

        const attributes = UserManagementConstants.SCIM2_ATTRIBUTES_DICTIONARY.get("ACCOUNT_LOCKED") + "," +
            UserManagementConstants.SCIM2_ATTRIBUTES_DICTIONARY.get("ACCOUNT_DISABLED") + "," +
            UserManagementConstants.SCIM2_ATTRIBUTES_DICTIONARY.get("ONETIME_PASSWORD");

        getUserDetails(user?.id, attributes)
            .then((response) => {
                setAccountLock(response[ProfileConstants.SCIM2_ENT_USER_SCHEMA]?.accountLocked);
                setAccountDisable(response[ProfileConstants.SCIM2_ENT_USER_SCHEMA]?.accountDisabled);
                setOneTimePassword(response[ProfileConstants.SCIM2_ENT_USER_SCHEMA]?.oneTimePassword);
            });
    }, [ user ]);

    /**
     * This will load the countries to the dropdown.
     */
    useEffect(() => {
        setCountryList(CommonUtils.getCountryList());
    }, []);

    /**
     * The following function maps profile details to the SCIM schemas.
     *
     * @param proSchema ProfileSchema
     * @param userInfo BasicProfileInterface
     */
    const mapUserToSchema = (proSchema: ProfileSchemaInterface[], userInfo: ProfileInfoInterface): void => {
        if (!isEmpty(profileSchema) && !isEmpty(userInfo)) {
            const tempProfileInfo: Map<string, string> = new Map<string, string>();

            proSchema.forEach((schema: ProfileSchemaInterface) => {
                const schemaNames = schema.name.split(".");

                if (schemaNames.length === 1) {
                    if (schemaNames[0] === "emails") {
                        if(ProfileUtils.isStringArray(userInfo[schemaNames[0]])) {
                            const emails: any[] = userInfo[schemaNames[0]];
                            const primaryEmail = emails.find((subAttribute) => typeof subAttribute === "string");

                            // Set the primary email value.
                            tempProfileInfo.set(schema.name, primaryEmail);
                        }
                    } else {
                        if (schema.extended && userInfo[ProfileConstants.SCIM2_ENT_USER_SCHEMA]) {
                            tempProfileInfo.set(
                                schema.name, userInfo[ProfileConstants.SCIM2_ENT_USER_SCHEMA][schemaNames[0]]
                            );
                            return;
                        }
                        tempProfileInfo.set(schema.name, userInfo[schemaNames[0]]);
                    }
                } else {
                    if (schemaNames[0] === "name") {
                        const name = schemaNames[1] && userInfo[schemaNames[0]] &&
                            userInfo[schemaNames[0]][schemaNames[1]] && (
                                tempProfileInfo.set(schema.name, userInfo[schemaNames[0]][schemaNames[1]])
                            );
                    } else {
                        if (schema.extended && userInfo[ProfileConstants.SCIM2_ENT_USER_SCHEMA]) {
                            const complexEnterprise = schemaNames[0] && schemaNames[1] &&
                                userInfo[ProfileConstants.SCIM2_ENT_USER_SCHEMA][schemaNames[0]] &&
                                userInfo[ProfileConstants.SCIM2_ENT_USER_SCHEMA][schemaNames[0]][schemaNames[1]] && (
                                tempProfileInfo.set(schema.name,
                                    userInfo[ProfileConstants.SCIM2_ENT_USER_SCHEMA][schemaNames[0]][schemaNames[1]])
                                );
                        } else {
                            const subValue = userInfo[schemaNames[0]]
                                && userInfo[schemaNames[0]]
                                    .find((subAttribute) => subAttribute.type === schemaNames[1]);
                            if (schemaNames[0] === "addresses") {
                                tempProfileInfo.set(
                                    schema.name,
                                    subValue ? subValue.formatted : ""
                                );
                            } else {
                                tempProfileInfo.set(
                                    schema.name,
                                    subValue ? subValue.value : ""
                                );
                            }
                        }
                    }
                }
            });

            setProfileInfo(tempProfileInfo);
        }
    };

    /**
     * Sort the elements of the profileSchema state according by the displayOrder attribute in the ascending order.
     */
    useEffect(() => {
        const sortedSchemas = ProfileUtils.flattenSchemas([...profileSchemas])
            .sort((a: ProfileSchemaInterface, b: ProfileSchemaInterface) => {
                if (!a.displayOrder) {
                    return -1;
                } else if (!b.displayOrder) {
                    return 1;
                } else {
                    return parseInt(a.displayOrder, 10) - parseInt(b.displayOrder, 10);
                }
            });

        setProfileSchema(sortedSchemas);

        const url = sortedSchemas.filter((schema: ProfileSchemaInterface) => {
            return schema.name === "profileUrl";
        });
    }, [profileSchemas]);

    useEffect(() => {
        mapUserToSchema(profileSchema, user);
    }, [profileSchema, user]);

    /**
     * This function handles deletion of the user.
     *
     * @param deletingUser
     */
    const handleUserDelete = (deletingUser: ProfileInfoInterface): void => {
        userConfig.deleteUser(deletingUser)
            .then(() => {
                onAlertFired({
                    description: t(
                        "console:manage.features.users.notifications.deleteUser.success.description"
                    ),
                    level: AlertLevels.SUCCESS,
                    message: t(
                        "console:manage.features.users.notifications.deleteUser.success.message"
                    )
                });
                history.push(AppConstants.getPaths().get("USERS"));
            })
            .catch((error) => {
                if (error.response && error.response.data && error.response.data.description) {
                    setAlert({
                        description: error.response.data.description,
                        level: AlertLevels.ERROR,
                        message: t("console:manage.features.users.notifications.deleteUser.error.message")
                    });

                    return;
                }

                setAlert({
                    description: t("console:manage.features.users.notifications.deleteUser.genericError.description"),
                    level: AlertLevels.ERROR,
                    message: t("console:manage.features.users.notifications.deleteUser.genericError" +
                        ".message")
                });
            });
    };

    /**
     * The following method handles the `onSubmit` event of forms.
     *
     * @param values
     */
    const handleSubmit = (values: Map<string, string | string[]>): void => {

        const data = {
            Operations: [],
            schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
        };

        let operation = {
            op: "replace",
            value: {}
        };

        profileSchema.forEach((schema: ProfileSchemaInterface) => {

            if (schema.mutability === ProfileConstants.READONLY_SCHEMA) {
                return;
            }

            let opValue = {};

            const schemaNames = schema.name.split(".");

            if (schema.name !== "roles.default") {
                if (values.get(schema.name) !== undefined && values.get(schema.name).toString() !== undefined) {

                    if (ProfileUtils.isMultiValuedSchemaAttribute(profileSchema, schemaNames[0]) ||
                        schemaNames[0] === "phoneNumbers") {

                        const attributeValues = [];
                        const attValues: Map<string, string | string []> = new Map();

                        if (schemaNames.length === 1 || schema.name === "phoneNumbers.mobile") {

                            // Extract the sub attributes from the form values.
                            for (const value of values.keys()) {
                                const subAttribute = value.split(".");

                                if (subAttribute[0] === schemaNames[0]) {
                                    attValues.set(value, values.get(value));
                                }
                            }

                            for (const [key, value] of attValues) {
                                const attribute = key.split(".");

                                if (value && value !== "") {
                                    if (attribute.length === 1) {
                                        attributeValues.push(value);
                                    } else {
                                        attributeValues.push({
                                                type: attribute[1],
                                                value: value
                                        });
                                    }
                                }
                            }

                            opValue = {
                                [schemaNames[0]]: attributeValues
                            };
                        }
                    } else {
                        if (schemaNames.length === 1) {
                            if (schema.extended) {
                                opValue = {
                                    [ProfileConstants.SCIM2_ENT_USER_SCHEMA]: {
                                        [schemaNames[0]]: schema.type.toUpperCase() === "BOOLEAN" ?
                                            !!values.get(schema.name)?.includes(schema.name) :
                                            values.get(schemaNames[0])
                                    }
                                };
                            } else {
                                opValue = schemaNames[0] === UserManagementConstants.SCIM2_SCHEMA_DICTIONARY
                                        .get("EMAILS")
                                    ? { emails: [values.get(schema.name)] }
                                    : { [schemaNames[0]]: values.get(schemaNames[0]) };
                            }
                        } else {
                            if(schema.extended) {
                                opValue = {
                                    [ProfileConstants.SCIM2_ENT_USER_SCHEMA]: {
                                        [schemaNames[0]]: {
                                            [schemaNames[1]]: schema.type.toUpperCase() === "BOOLEAN" ?
                                                !!values.get(schema.name)?.includes(schema.name) :
                                                values.get(schema.name)
                                        }
                                    }
                                };
                            } else if (schemaNames[0] === UserManagementConstants.SCIM2_SCHEMA_DICTIONARY.get("NAME")) {
                                const name = values.get(schema.name) && (
                                    opValue = {
                                        name: { [schemaNames[1]]: values.get(schema.name) }
                                    }
                                );
                            } else {
                                if (schemaNames[0] === "addresses") {
                                    opValue = {
                                        [schemaNames[0]]: [
                                            {
                                                formatted: values.get(schema.name),
                                                type: schemaNames[1]
                                            }
                                        ]
                                    };
                                } else if (schemaNames[0] !== "emails" && schemaNames[0] !== "phoneNumbers") {
                                    opValue = {
                                        [schemaNames[0]]: [
                                            {
                                                type: schemaNames[1],
                                                value: schema.type.toUpperCase() === "BOOLEAN" ?
                                                    !!values.get(schema.name)?.includes(schema.name) :
                                                    values.get(schema.name)
                                            }
                                        ]
                                    };
                                }
                            }
                        }
                    }
                }
            }

            operation = {
                op: "replace",
                value: opValue
            };
            // This is required as the api doesn't support patching the address attributes at the
            // sub attribute level using 'replace' operation.
            if (schemaNames[0] === "addresses") {
                operation.op = "add";
            }
            data.Operations.push(operation);
        });

        updateUserInfo(user.id, data)
            .then(() => {
                onAlertFired({
                        description: t(
                            "console:manage.features.user.profile.notifications.updateProfileInfo.success.description"
                        ),
                        level: AlertLevels.SUCCESS,
                        message: t(
                            "console:manage.features.user.profile.notifications.updateProfileInfo.success.message"
                        )
                    });

                handleUserUpdate(user.id);
            })
            .catch((error: AxiosError) => {

                if (error?.response?.data?.detail || error?.response?.data?.description) {
                    dispatch(addAlert({
                        description: error?.response?.data?.detail || error?.response?.data?.description,
                        level: AlertLevels.ERROR,
                        message: t("console:manage.features.user.profile.notifications.updateProfileInfo." +
                            "error.message")
                    }));

                    return;
                }

                dispatch(addAlert({
                    description: t("console:manage.features.user.profile.notifications.updateProfileInfo." +
                        "genericError.description"),
                    level: AlertLevels.ERROR,
                    message: t("console:manage.features.user.profile.notifications.updateProfileInfo." +
                        "genericError.message")
                }));
            });
    };

    /**
     * Handle danger zone toggle actions.
     *
     * @param toggleData
     */
    const handleDangerZoneToggles = (toggleData: CheckboxProps) => {
        setEditingAttribute({
            name: toggleData?.target?.id,
            value: toggleData?.target?.checked
        });

        if(toggleData?.target?.checked) {
            setShowDisableConfirmationModal(true);
        } else {
            handleDangerActions(toggleData?.target?.id, toggleData?.target?.checked);
        }
    };

    /**
     * The method handles the locking and disabling of user account.
     */
    const handleDangerActions = (attributeName: string, attributeValue: boolean): void => {
        const data = {
            "Operations": [
                {
                    "op": "replace",
                    "value": {
                        [ProfileConstants.SCIM2_ENT_USER_SCHEMA]: {
                            [attributeName]: attributeValue
                        }
                    }
                }
            ],
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
        };

        updateUserInfo(user.id, data)
            .then(() => {
                onAlertFired({
                    description:
                        attributeName === "accountLocked"
                            ? (
                                attributeValue
                                    ? t("console:manage.features.user.profile.notifications.lockUserAccount." +
                                    "success.description")
                                    : t("console:manage.features.user.profile.notifications.unlockUserAccount." +
                                    "success.description")
                            ) : (
                                attributeValue
                                    ? t("console:manage.features.user.profile.notifications.disableUserAccount." +
                                    "success.description")
                                    : t("console:manage.features.user.profile.notifications.enableUserAccount." +
                                    "success.description")
                            ),
                    level: AlertLevels.SUCCESS,
                    message:
                        attributeName === "accountLocked"
                            ? (
                                attributeValue
                                    ? t("console:manage.features.user.profile.notifications.lockUserAccount." +
                                    "success.message", { name: user.userName })
                                    : t("console:manage.features.user.profile.notifications.unlockUserAccount." +
                                    "success.message", { name: user.userName })
                            ) : (
                                attributeValue
                                    ? t("console:manage.features.user.profile.notifications.disableUserAccount." +
                                    "success.message", { name: user.userName })
                                    : t("console:manage.features.user.profile.notifications.enableUserAccount." +
                                    "success.message", { name: user.userName })
                            )
            });
            setShowDisableConfirmationModal(false);
            handleUserUpdate(user.id);
            setEditingAttribute(undefined);
        })
        .catch((error) => {
            if (error.response && error.response.data && error.response.data.description) {
                onAlertFired({
                    description: error.response.data.description,
                    level: AlertLevels.ERROR,
                    message:
                        attributeName === "accountLocked"
                            ? t("console:manage.features.user.profile.notifications.lockUserAccount.error." +
                            "message")
                            : t("console:manage.features.user.profile.notifications.disableUserAccount.error." +
                            "message")
                });

                return;
            }

            onAlertFired({
                description:
                    editingAttribute?.name === "accountLocked"
                        ? t("console:manage.features.user.profile.notifications.lockUserAccount.genericError." +
                        "description")
                        : t("console:manage.features.user.profile.notifications.disableUserAccount.genericError." +
                        "description"),
                level: AlertLevels.ERROR,
                message:
                    editingAttribute?.name === "accountLocked"
                        ? t("console:manage.features.user.profile.notifications.lockUserAccount.genericError." +
                        "message")
                        : t("console:manage.features.user.profile.notifications.disableUserAccount.genericError." +
                        "message")
            });
        });
    };

    const resolveDangerActions = (): ReactElement => {
        if (!hasRequiredScopes(
            featureConfig?.users, featureConfig?.users?.scopes?.update, allowedScopes)) {
            return null;
        }

        return (
            <>
                {
                    (hasRequiredScopes(featureConfig?.users, featureConfig?.users?.scopes?.delete,
                        allowedScopes) && (!isReadOnly || allowDeleteOnly) &&
                        !(user.userName === tenantAdmin || user.userName === "admin") &&
                        !authenticatedUser.includes(user.userName)) && (
                        <DangerZoneGroup
                            sectionHeader={ t("console:manage.features.user.editUser.dangerZoneGroup.header") }
                        >
                            {
                                !allowDeleteOnly && configSettings?.accountDisable === "true" && (
                                    <DangerZone
                                        data-testid={ `${ testId }-danger-zone` }
                                        actionTitle={ t("console:manage.features.user.editUser.dangerZoneGroup." +
                                            "disableUserZone.actionTitle") }
                                        header={ t("console:manage.features.user.editUser.dangerZoneGroup." +
                                            "disableUserZone.header") }
                                        subheader={ t("console:manage.features.user.editUser.dangerZoneGroup." +
                                            "disableUserZone.subheader") }
                                        onActionClick={ undefined }
                                        toggle={ {
                                            checked: accountDisable
                                                ? accountDisable
                                                : user[ProfileConstants.SCIM2_ENT_USER_SCHEMA]?.accountDisabled,
                                            id: "accountDisabled",
                                            onChange: handleDangerZoneToggles
                                        } }
                                    />
                                )
                            }
                            {
                                !allowDeleteOnly && configSettings?.accountLock === "true" && (
                                    <DangerZone
                                        data-testid={ `${ testId }-danger-zone` }
                                        actionTitle={ t("console:manage.features.user.editUser.dangerZoneGroup." +
                                            "lockUserZone.actionTitle") }
                                        header={
                                            t("console:manage.features.user.editUser.dangerZoneGroup.lockUserZone." +
                                                "header")
                                        }
                                        subheader={
                                            t("console:manage.features.user.editUser.dangerZoneGroup.lockUserZone." +
                                                "subheader")
                                        }
                                        onActionClick={ undefined }
                                        toggle={ {
                                            checked: accountLock
                                                ? accountLock
                                                : user[ProfileConstants.SCIM2_ENT_USER_SCHEMA]?.accountLocked,
                                            id: "accountLocked",
                                            onChange: handleDangerZoneToggles
                                        } }
                                    />
                                )
                            }
                            <DangerZone
                                data-testid={ `${ testId }-danger-zone` }
                                actionTitle={ t("console:manage.features.user.editUser.dangerZoneGroup." +
                                    "deleteUserZone.actionTitle") }
                                header={ t("console:manage.features.user.editUser.dangerZoneGroup." +
                                    "deleteUserZone.header") }
                                subheader={ commonConfig.userEditSection.isGuestUser
                                    ? t("extensions:manage.guest.editUser.dangerZoneGroup.deleteUserZone.subheader")
                                    : t("console:manage.features.user.editUser.dangerZoneGroup.deleteUserZone." +
                                        "subheader")
                                }
                                onActionClick={ (): void => {
                                    setShowDeleteConfirmationModal(true);
                                    setDeletingUser(user);
                                } }
                            />
                        </DangerZoneGroup>
                    )
                }
            </>
        );
    };

    const resolveFormField = (schema: ProfileSchemaInterface, fieldName: string, key: number): ReactElement => {
        if (schema.type.toUpperCase() === "BOOLEAN") {
            return (
                <Field
                    data-testid={ `${ testId }-profile-form-${ schema.name }-input` }
                    name={ schema.name }
                    required={ schema.required }
                    requiredErrorMessage={ fieldName + " " + "is required" }
                    type="checkbox"
                    value={ profileInfo.get(schema.name) ? [schema.name] : [] }
                    children={ [
                        {
                            label: fieldName,
                            value: schema.name
                        }
                    ] }
                    readOnly={ isReadOnly || schema.mutability === ProfileConstants.READONLY_SCHEMA }
                    key={ key }
                />
            );
        } else if (schema.name === "country") {
            return (
                <Field
                    data-testid={ `${ testId }-profile-form-${ schema.name }-input` }
                    name={ schema.name }
                    label={ fieldName }
                    required={ schema.required }
                    requiredErrorMessage={ fieldName + " " + "is required" }
                    placeholder={ "Select your" + " " + fieldName }
                    type="dropdown"
                    value={ profileInfo.get(schema.name) }
                    children={ countryList ? countryList.map(list => {
                        return {
                            "data-testid": `${ testId }-profile-form-country-dropdown-` +  list.value as string,
                            key: list.key as string,
                            text: list.text as string,
                            value: list.value as string,
                            flag: list.flag
                        };
                    }) : [] }
                    key={ key }
                    disabled={ false }
                    readOnly={ isReadOnly || schema.mutability === ProfileConstants.READONLY_SCHEMA }
                    clearable={ !schema.required }
                    search
                    selection
                    fluid
                />
            );
        } else {
            return (
                <Field
                    data-testid={ `${ testId }-profile-form-${ schema.name }-input` }
                    name={ schema.name }
                    label={ schema.name === "profileUrl" ? "Profile Image URL" :
                        (  (!commonConfig.userEditSection.showEmail && schema.name === "userName")
                                ? fieldName +" (Email)"
                                : fieldName
                        )
                    }
                    required={ schema.required }
                    requiredErrorMessage={ fieldName + " " + "is required" }
                    placeholder={ "Enter your" + " " + fieldName }
                    type="text"
                    value={ profileInfo.get(schema.name) }
                    key={ key }
                    disabled={ schema.name === "userName" }
                    readOnly={ isReadOnly || schema.mutability === ProfileConstants.READONLY_SCHEMA }
                    validation={ (value: string, validation: Validation) => {
                        if (!RegExp(schema.regEx).test(value)) {
                            validation.isValid = false;
                            validation.errorMessages
                                .push(t("console:manage.features.users.forms.validation.formatError", {
                                    field: fieldName
                                }));
                        }
                    } }
                    maxLength={ 30 }
                />
            );
        }
    };

    /**
     * If the profile schema is read only or the user is read only, the profile detail for a profile schema should
     * only be displayed in the form only if there is a value for the schema. This function validates whether the
     * filed should be displayed considering these factors.
     *
     * @param {ProfileSchemaInterface} schema
     * @return {boolean} whether the field for the input schema should be displayed.
     */
    const isFieldDisplayable = (schema: ProfileSchemaInterface): boolean => {
        return (!isEmpty(profileInfo.get(schema.name)) ||
            (!isReadOnly && (schema.mutability !== ProfileConstants.READONLY_SCHEMA)));
    };

    /**
     * This function generates the user profile details form based on the input Profile Schema
     *
     * @param {ProfileSchemaInterface} schema
     * @param {number} key
     */
    const generateProfileEditForm = (schema: ProfileSchemaInterface, key: number): JSX.Element => {
        const fieldName = t("console:manage.features.user.profile.fields." +
            schema.name.replace(".", "_"), { defaultValue: schema.displayName }
        );

        const domainName = profileInfo?.get(schema.name)?.toString().split("/");

        return (
            <Grid.Row columns={ 1 } key={ key }>
                <Grid.Column mobile={ 12 } tablet={ 12 } computer={ 6 }>
                    {
                        schema.name === "userName" && domainName.length > 1 ? (
                            <Form.Field>
                                <label>
                                    { !commonConfig.userEditSection.showEmail
                                        ? fieldName + " (Email)"
                                        : fieldName
                                    }
                                </label>
                                <Input
                                    data-testid={ `${ testId }-profile-form-${ schema.name }-input` }
                                    name={ schema.name }
                                    label={ domainName[0] + " / " }
                                    required={ schema.required }
                                    requiredErrorMessage={ fieldName + " " + "is required" }
                                    placeholder={ "Enter your" + " " + fieldName }
                                    type="text"
                                    value={ domainName[1] }
                                    key={ key }
                                    readOnly={ isReadOnly || schema.mutability === ProfileConstants.READONLY_SCHEMA }
                                    maxLength={ 30 }
                                />
                            </Form.Field>
                        ) : (
                            resolveFormField(schema, fieldName, key)
                        )
                    }
                </Grid.Column>
            </Grid.Row>
        );
    };

    return (
        !isReadOnlyUserStoresLoading ? (
        <>
            {
                <Grid>
                    <Grid.Row>
                        <Grid.Column>
                            {
                                (hasRequiredScopes(featureConfig?.users,
                                    featureConfig?.users?.scopes?.update, allowedScopes) &&
                                    !isReadOnly && user.userName !== "admin") && (
                                        <Button
                                            basic
                                            color="orange"
                                            onClick={ () => setOpenChangePasswordModal(true) }
                                            floated="right"
                                        >
                                            <Icon name="redo" />
                                            { t("console:manage.features.user.modals.changePasswordModal.button") }
                                        </Button>
                                    )
                            }
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            }
            {
                !isEmpty(profileInfo) && (
                    <EmphasizedSegment padded="very">
                        {
                            (isReadOnly && !isEmpty(tenantAdmin)) && editUserDisclaimerMessage
                        }
                        <Forms
                            data-testid={ `${ testId }-form` }
                            onSubmit={ (values) => handleSubmit(values) }
                        >
                            <Grid>
                                {
                                    user.id && (
                                        <Grid.Row columns={ 1 }>
                                            <Grid.Column mobile={ 12 } tablet={ 12 } computer={ 6 }>
                                                <Form.Field>
                                                    <label>
                                                        { t("console:manage.features.user.profile.fields.userId") }
                                                    </label>
                                                    <Input
                                                        name="userID"
                                                        type="text"
                                                        value={ user.id }
                                                        readOnly={ true }
                                                    />
                                                </Form.Field>
                                            </Grid.Column>
                                        </Grid.Row>
                                    )
                                }
                                {
                                    profileSchema
                                    && profileSchema.map((schema: ProfileSchemaInterface, index: number) => {
                                        if (!(schema.name === ProfileConstants?.
                                                SCIM2_SCHEMA_DICTIONARY.get("ROLES_DEFAULT")
                                            || schema.name === ProfileConstants?.
                                                SCIM2_SCHEMA_DICTIONARY.get("GROUPS")
                                            || schema.name === ProfileConstants?.
                                                SCIM2_SCHEMA_DICTIONARY.get("PROFILE_URL")
                                            || schema.name === ProfileConstants?.
                                                SCIM2_SCHEMA_DICTIONARY.get("ACCOUNT_LOCKED")
                                            || schema.name === ProfileConstants?.
                                                SCIM2_SCHEMA_DICTIONARY.get("ACCOUNT_DISABLED")
                                            || schema.name === ProfileConstants?.
                                                SCIM2_SCHEMA_DICTIONARY.get("ONETIME_PASSWORD")
                                            || (!commonConfig.userEditSection.showEmail &&
                                                schema.name === ProfileConstants?.
                                                SCIM2_SCHEMA_DICTIONARY.get("EMAILS")))
                                            && isFieldDisplayable(schema)) {
                                            return (
                                                generateProfileEditForm(schema, index)
                                            );
                                        }
                                    })
                                }
                                {
                                    oneTimePassword && (
                                        <Grid.Row columns={ 1 }>
                                            <Grid.Column mobile={ 12 } tablet={ 12 } computer={ 6 }>
                                                <Field
                                                    data-testid={ `${ testId }-profile-form-one-time-pw }
                                                    -input` }
                                                    name="oneTimePassword"
                                                    label={ t("console:manage.features.user.profile.fields." +
                                                        "oneTimePassword") }
                                                    required={ false }
                                                    requiredErrorMessage=""
                                                    type="text"
                                                    hidden={ oneTimePassword === undefined }
                                                    value={ oneTimePassword && oneTimePassword }
                                                    readOnly={ true }
                                                />
                                            </Grid.Column>
                                        </Grid.Row>
                                    )
                                }
                                <Grid.Row columns={ 1 }>
                                    <Grid.Column mobile={ 16 } tablet={ 16 } computer={ 8 }>
                                        {
                                            !isReadOnly && (
                                                <Button
                                                    data-testid={ `${ testId }-form-update-button` }
                                                    primary
                                                    type="submit"
                                                    size="small"
                                                    className="form-button"
                                                >
                                                    Update
                                                </Button>
                                            )
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Forms>
                    </EmphasizedSegment>
                )
            }
            <Divider hidden />
            { resolveDangerActions() }
            {
                deletingUser && (
                    <ConfirmationModal
                        data-testid={ `${ testId }-confirmation-modal` }
                        onClose={ (): void => setShowDeleteConfirmationModal(false) }
                        type="negative"
                        open={ showDeleteConfirmationModal }
                        assertionHint={ t("console:manage.features.user.deleteUser.confirmationModal." +
                            "assertionHint") }
                        assertionType="checkbox"
                        primaryAction={ t("common:confirm") }
                        secondaryAction={ t("common:cancel") }
                        onSecondaryActionClick={ (): void => {
                            setShowDeleteConfirmationModal(false);
                            setAlert(null);
                        } }
                        onPrimaryActionClick={ (): void => handleUserDelete(deletingUser) }
                        closeOnDimmerClick={ false }
                    >
                        <ConfirmationModal.Header data-testid={ `${ testId }-confirmation-modal-header` }>
                            { t("console:manage.features.user.deleteUser.confirmationModal.header") }
                        </ConfirmationModal.Header>
                        <ConfirmationModal.Message
                            data-testid={ `${ testId }-confirmation-modal-message` }
                            attached
                            negative
                         >
                            { commonConfig.userEditSection.isGuestUser
                                ? t("extensions:manage.guest.deleteUser.confirmationModal.message")
                                : t("console:manage.features.user.deleteUser.confirmationModal.message")
                            }
                        </ConfirmationModal.Message>
                        <ConfirmationModal.Content>
                            <div className="modal-alert-wrapper"> { alert && alertComponent }</div>
                            { commonConfig.userEditSection.isGuestUser
                                ? t("extensions:manage.guest.deleteUser.confirmationModal.content")
                                : t("console:manage.features.user.deleteUser.confirmationModal.content")
                            }
                        </ConfirmationModal.Content>
                    </ConfirmationModal>
                )
            }
            {
                editingAttribute && (
                    <ConfirmationModal
                        data-testid={ `${ testId }-confirmation-modal` }
                        onClose={ (): void => {
                            setShowDisableConfirmationModal(false);
                            setEditingAttribute(undefined);
                        } }
                        type="warning"
                        open={ showDisableConfirmationModal }
                        assertion={ user.userName }
                        assertionHint={ (
                            <p>
                                <Trans
                                    i18nKey={ "console:manage.features.user.disableUser.confirmationModal." +
                                    "assertionHint" }
                                    tOptions={ { userName: user.userName } }
                                >
                                    Please type <strong>{ user.userName }</strong> to confirm.
                                </Trans>
                            </p>
                        ) }
                        assertionType="input"
                        primaryAction={ t("common:confirm") }
                        secondaryAction={ t("common:cancel") }
                        onSecondaryActionClick={ (): void => {
                            setEditingAttribute(undefined);
                            handleUserUpdate(user.id);
                            setShowDisableConfirmationModal(false);
                        } }
                        onPrimaryActionClick={ () =>
                            handleDangerActions(editingAttribute.name, editingAttribute.value)
                        }
                        closeOnDimmerClick={ false }
                    >
                        <ConfirmationModal.Header data-testid={ `${ testId }-confirmation-modal-header` }>
                            { t("console:manage.features.user.disableUser.confirmationModal.header") }
                        </ConfirmationModal.Header>
                        <ConfirmationModal.Message
                            data-testid={ `${ testId }-disable-confirmation-modal-message` }
                            attached
                            warning
                        >
                            { t("console:manage.features.user.disableUser.confirmationModal.message") }
                        </ConfirmationModal.Message>
                        <ConfirmationModal.Content>
                            {
                                deletingUser[SCIMConfigs.scim.enterpriseSchema]?.userSourceId
                                    ? t("console:manage.features.user.deleteJITUser.confirmationModal.content")
                                    : t("console:manage.features.user.deleteUser.confirmationModal.content")
                            }
                        </ConfirmationModal.Content>
                    </ConfirmationModal>
                )
            }
            {
                editingAttribute && (
                    <ConfirmationModal
                        data-testid={ `${ testId }-lock-confirmation-modal` }
                        onClose={ (): void => {
                            setShowLockConfirmationModal(false);
                            setEditingAttribute(undefined);
                        } }
                        type="warning"
                        open={ showLockConfirmationModal }
                        assertion={ user.userName }
                        assertionHint={ (
                            <p>
                                <Trans
                                    i18nKey={ "console:manage.features.user.lockUser.confirmationModal." +
                                    "assertionHint" }
                                    tOptions={ { userName: user.userName } }
                                >
                                    Please type <strong>{ user.userName }</strong> to confirm.
                                </Trans>
                            </p>
                        ) }
                        assertionType="input"
                        primaryAction={ t("common:confirm") }
                        secondaryAction={ t("common:cancel") }
                        onSecondaryActionClick={ (): void => {
                            setEditingAttribute(undefined);
                            handleUserUpdate(user.id);
                            setShowLockConfirmationModal(false);
                        } }
                        onPrimaryActionClick={ () =>
                            handleDangerActions(editingAttribute.name, editingAttribute.value)
                        }
                        closeOnDimmerClick={ false }
                    >
                        <ConfirmationModal.Header data-testid={ `${ testId }-lock-confirmation-modal-header` }>
                            { t("console:manage.features.user.lockUser.confirmationModal.header") }
                        </ConfirmationModal.Header>
                        <ConfirmationModal.Message
                            data-testid={ `${ testId }-confirmation-modal-message` }
                            attached
                            warning
                        >
                            { t("console:manage.features.user.lockUser.confirmationModal.message") }
                        </ConfirmationModal.Message>
                        <ConfirmationModal.Content>
                            { t("console:manage.features.user.lockUser.confirmationModal.content") }
                        </ConfirmationModal.Content>
                    </ConfirmationModal>
                )
            }
            <ChangePasswordComponent
                handleForcePasswordResetTrigger={ () => setForcePasswordTriggered(true) }
                connectorProperties={ connectorProperties }
                handleCloseChangePasswordModal={ () => setOpenChangePasswordModal(false) }
                openChangePasswordModal={ openChangePasswordModal }
                onAlertFired={ onAlertFired }
                user={ user }
                handleUserUpdate={ handleUserUpdate }
            />
        </>
        ) : <ContentLoader dimmer/>
    );
};

/**
 * User profile component default props.
 */
UserProfile.defaultProps = {
    "data-testid": "user-mgt-user-profile"
};
