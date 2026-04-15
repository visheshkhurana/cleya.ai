export declare function ensureContactListTables(): Promise<void>;
export declare function createContactList(params: {
    name: string;
    description?: string;
    tags?: string[];
}): Promise<any>;
export declare function addToContactList(params: {
    listId: string;
    contacts: Array<{
        email: string;
        firstName?: string;
        lastName?: string;
        company?: string;
        role?: string;
        phone?: string;
        linkedinUrl?: string;
        tags?: string[];
        customFields?: Record<string, any>;
    }>;
}): Promise<any>;
export declare function getContactLists(tag?: string): Promise<any>;
export declare function getListContacts(params: {
    listId: string;
    limit?: number;
    offset?: number;
}): Promise<any>;
export declare function importListToCampaign(params: {
    listId: string;
    campaignId: string;
}): Promise<any>;
export declare function deleteContactList(listId: string): Promise<any>;
//# sourceMappingURL=contactListService.d.ts.map