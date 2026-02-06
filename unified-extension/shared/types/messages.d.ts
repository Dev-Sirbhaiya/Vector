/**
 * Message types for communication between extension components
 */
export declare enum MessageType {
    PROCESS_COMMAND = "PROCESS_COMMAND",
    COMMAND_RESULT = "COMMAND_RESULT",
    GET_DOM_CONTEXT = "GET_DOM_CONTEXT",
    DOM_CONTEXT_RESPONSE = "DOM_CONTEXT_RESPONSE",
    EXECUTE_ACTION = "EXECUTE_ACTION",
    ACTION_RESULT = "ACTION_RESULT",
    CLARIFICATION_NEEDED = "CLARIFICATION_NEEDED",
    CLARIFICATION_RESPONSE = "CLARIFICATION_RESPONSE",
    GET_SETTINGS = "GET_SETTINGS",
    SETTINGS_RESPONSE = "SETTINGS_RESPONSE",
    SETTINGS_UPDATED = "SETTINGS_UPDATED",
    STATUS_UPDATE = "STATUS_UPDATE",
    ERROR = "ERROR",
    PING = "PING",
    PONG = "PONG"
}
export interface BaseMessage {
    type: MessageType;
    timestamp: number;
    correlationId?: string;
}
export interface ProcessCommandMessage extends BaseMessage {
    type: MessageType.PROCESS_COMMAND;
    payload: {
        command: string;
        tabId?: number;
    };
}
export interface CommandResultMessage extends BaseMessage {
    type: MessageType.COMMAND_RESULT;
    payload: {
        success: boolean;
        message: string;
        error?: string;
    };
}
export interface GetDOMContextMessage extends BaseMessage {
    type: MessageType.GET_DOM_CONTEXT;
}
export interface DOMContextResponseMessage extends BaseMessage {
    type: MessageType.DOM_CONTEXT_RESPONSE;
    payload: {
        success: boolean;
        context?: SimplifiedDOM;
        error?: string;
    };
}
export interface ExecuteActionMessage extends BaseMessage {
    type: MessageType.EXECUTE_ACTION;
    payload: ActionPayload;
}
export interface ActionResultMessage extends BaseMessage {
    type: MessageType.ACTION_RESULT;
    payload: {
        success: boolean;
        message?: string;
        error?: string;
        requiresRetry?: boolean;
    };
}
export interface ClarificationNeededMessage extends BaseMessage {
    type: MessageType.CLARIFICATION_NEEDED;
    payload: {
        question: string;
        options?: string[];
    };
}
export interface ClarificationResponseMessage extends BaseMessage {
    type: MessageType.CLARIFICATION_RESPONSE;
    payload: {
        answer: string;
    };
}
export interface StatusUpdateMessage extends BaseMessage {
    type: MessageType.STATUS_UPDATE;
    payload: {
        status: 'idle' | 'processing' | 'executing' | 'verifying' | 'error';
        message?: string;
    };
}
export interface ErrorMessage extends BaseMessage {
    type: MessageType.ERROR;
    payload: {
        error: string;
        code?: string;
    };
}
export type ExtensionMessage = ProcessCommandMessage | CommandResultMessage | GetDOMContextMessage | DOMContextResponseMessage | ExecuteActionMessage | ActionResultMessage | ClarificationNeededMessage | ClarificationResponseMessage | StatusUpdateMessage | ErrorMessage | BaseMessage;
export interface MessageResponse {
    success: boolean;
    data?: unknown;
    error?: string;
}
export declare function createMessage<T extends ExtensionMessage>(type: T['type'], payload?: T extends {
    payload: infer P;
} ? P : never): T;
export interface SimplifiedElement {
    id: string;
    tagName: string;
    role: string | null;
    text: string;
    attributes: {
        id?: string;
        className?: string;
        href?: string;
        type?: string;
        placeholder?: string;
        ariaLabel?: string;
        name?: string;
        value?: string;
    };
    isInteractive: boolean;
    isVisible: boolean;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    importance?: number;
    relativePosition?: string;
    region?: string;
    nearbyElements?: NearbyElement[];
    semanticContext?: ElementSemanticContext;
    contentFor?: ContentAssociation;
    actionHint?: string;
}
export interface NearbyElement {
    id: string;
    text: string;
    direction: string;
    distance: number;
}
export interface ElementSemanticContext {
    parentSection: string | null;
    parentSectionLabel: string | null;
    siblings: Array<{
        id: string;
        text: string;
    }>;
}
export interface ContentAssociation {
    containerType: string;
    title: string | null;
    buttonPurpose: string;
    associationText: string;
}
export interface PageSummary {
    text: string;
    stats: {
        totalElements: number;
        interactiveElements: number;
        headings: number;
        landmarks: number;
    };
    landmarks: string[];
}
export interface SpatialRegion {
    interactiveCount: number;
    description: string;
}
export interface SpatialGrid {
    regions: Record<string, SpatialRegion>;
    textRepresentation: string;
}
export interface ContentContainer {
    containerType: string;
    title: string | null;
    subtitle: string | null;
    fullDescription: string;
    actions: Array<{
        text: string;
        purpose: string;
        description: string;
    }>;
}
export interface NavigationStep {
    step: number;
    type: string;
    description: string;
}
export interface SimplifiedDOM {
    url: string;
    title: string;
    timestamp: number;
    elements: SimplifiedElement[];
    pageText: string;
    pageSummary?: PageSummary;
    spatialGrid?: SpatialGrid;
    contentContainers?: ContentContainer[];
    navigationGuide?: NavigationStep[];
    pageType?: string;
    primaryAction?: {
        text: string;
        type: string;
    } | null;
    viewport?: {
        width: number;
        height: number;
    };
    documentSize?: {
        width: number;
        height: number;
    };
}
export interface ActionPayload {
    type: 'click' | 'fill' | 'scroll' | 'navigate' | 'extract' | 'modify' | 'tab' | 'keyboard' | 'browser';
    target?: string;
    value?: string | Record<string, unknown>;
    description?: string;
    verification?: {
        type: 'domChange' | 'navigation' | 'styleChange';
        expectedResult: string;
    };
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    actions?: ActionPayload[];
    isError?: boolean;
}
//# sourceMappingURL=messages.d.ts.map