/**
 * Copyright (c) 2019, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
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
 * under the License.
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Divider, Form, Grid, Icon, List } from "semantic-ui-react";
import { getProfileInfo, updateProfileInfo } from "../actions";
import { MFAIcons } from "../configs";
import { NotificationActionPayload } from "../models/notifications";
import { EditSection } from "./edit-section";
import { ThemeIcon } from "./icon";

/**
 * Proptypes for the SMS OTP component.
 */
interface EmailRecoveryProps {
    onNotificationFired: (notification: NotificationActionPayload) => void;
}

/**
 * Email recovery section.
 *
 * @return {JSX.Element}
 */
export const EmailRecovery: React.FunctionComponent<EmailRecoveryProps> = (
    props: EmailRecoveryProps
): JSX.Element => {
    const [email, setEmail] = useState("");
    const [editedEmail, setEditedEmail] = useState("");
    const [isEdit, setIsEdit] = useState(false);
    const {t} = useTranslation();
    const {onNotificationFired} = props;

    const handleUpdate = () => {
        const data = {
            Operations: [
                {
                    op: "replace",
                    value: {}
                }
            ],
            schemas: [
                "urn:ietf:params:scim:api:messages:2.0:PatchOp"
            ]
        };

        data.Operations[0].value = {
            emails: [editedEmail]
        };

        updateProfileInfo(data)
            .then((response) => {
                if (response.status === 200) {
                    onNotificationFired({
                        description: t(
                            "views:accountRecovery.emailRecovery.notification.success.description"
                        ),
                        message: t(
                            "views:accountRecovery.emailRecovery.notification.success.message"
                        ),
                        otherProps: {
                            positive: true
                        },
                        visible: true
                    });
                    getProfileInfo()
                        .then((res) => {
                            setEmailAddr(res);
                        });
                    setIsEdit(false);
                } else {
                    onNotificationFired({
                        description: t(
                            "views:userProfile.notification.getProfileInfo.error.description"
                        ),
                        message: t(
                            "views:userProfile.notification.getProfileInfo.error.message"
                        ),
                        otherProps: {
                            negative: true
                        },
                        visible: true
                    });
                }
            });
    };

    /**
     * The following function handles the change of state of the input fields.
     * The id of the event target will be used to set the state.
     * @param event
     */
    const handleFieldChange = (event) => {
        setEditedEmail(event.target.value);
        event.preventDefault();
    };

    const setEmailAddr = (resp) => {
        let emailAddress = "";
        resp.emails.map((email) => {
            emailAddress = email;
        });
        setEmail(emailAddress);
        setEditedEmail(emailAddress);
    };

    const handleEdit = () => {
        setIsEdit(true);
    };

    const handleCancel = () => {
        setIsEdit(false);
    };

    const showEditView = () => {
        if (!isEdit) {
            return (<Grid padded>
                    <Grid.Row columns={2}>
                        <Grid.Column width={11} className="first-column">
                            <List.Content floated="left">
                                <ThemeIcon
                                    icon={MFAIcons.sms}
                                    size="mini"
                                    twoTone
                                    transparent
                                    square
                                    rounded
                                    relaxed
                                />
                            </List.Content>
                            <List.Content>
                                <List.Header>{t("views:accountRecovery.emailRecovery.title")}</List.Header>
                                <List.Description>
                                    {t("views:accountRecovery.emailRecovery.description")}
                                </List.Description>
                            </List.Content>
                        </Grid.Column>
                        <Grid.Column width={5} className="last-column">
                            <List.Content floated="right">
                                <Icon
                                    link
                                    onClick={handleEdit}
                                    className="list-icon"
                                    size="small"
                                    color="grey"
                                    name="pencil alternate"
                                />
                            </List.Content>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            );
        }
        return (
            <EditSection>
                <Grid>
                    <Grid.Row>
                        <Grid.Column>
                            <List>
                                <List.Item>
                                    <List.Content>
                                        <Form>
                                            <Form.Field width={9}>
                                                <label>{t("views:accountRecovery.emailRecovery.emailAddress")}</label>
                                                <input onChange={handleFieldChange} value={editedEmail}/>
                                                <br /><br />
                                                <p style={{fontSize: "12px"}}>
                                                
                                                </p>
                                            </Form.Field>
                                        </Form>
                                    </List.Content>
                                </List.Item>
                                <Divider hidden/>
                                <List.Item>
                                    <Button primary onClick={handleUpdate} size="small">
                                        {t("common:update")}
                                    </Button>
                                    <Button className="link-button" onClick={handleCancel} size="small">
                                        {t("common:cancel")}
                                    </Button>
                                </List.Item>
                            </List>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            </EditSection>
        );
    };

    useEffect(() => {
        if (isEdit) {
            getProfileInfo()
                .then((response) => {
                    setEmailAddr(response);
                });
        }
    },[isEdit]);

    return (
        <div>
            {showEditView()}
        </div>
    );
};
