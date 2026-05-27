import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Button, Input, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseOutlined,
  CodeOutlined,
  DeleteOutlined,
  FileTextOutlined,
  RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_PUBLIC_TENANT_PROFILE,
  getPublicTenantProfile,
  sendAgentChat,
  type PublicTenantProfile,
} from '@/services/api';
import './style.css';

type ChatRole = 'assistant' | 'user';
type MockSkillStatus = 'draft_created' | 'ready_for_review';

interface MockSkillAction {
  id: string;
  skill: string;
  title: string;
  status: MockSkillStatus;
  summary: string;
  fields: Array<{ label: string; value: string }>;
  nextSteps: string[];
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  actions?: MockSkillAction[];
  source?: string;
}

interface PageContext {
  title: string;
  scope: string;
  intro: string;
  quickPrompts: string[];
}

interface AiChatWidgetProps {
  pageTitle: string;
  applicationName?: string;
}

interface AssistantReply {
  content: string;
  actions?: MockSkillAction[];
}

interface AgentSkillAction {
  skill?: string;
  title?: string;
  mode?: string;
  risk_level?: string;
  requires_confirmation?: boolean;
  payload?: Record<string, unknown>;
}

interface AgentChatResponse {
  answer?: string;
  actions?: AgentSkillAction[];
  mode?: string;
  requires_confirmation?: boolean;
  steps?: Array<Record<string, unknown>>;
}

const STORAGE_PREFIX = 'mf_ai_floating_chat:';
const POSITION_STORAGE_KEY = 'mf_ai_floating_position';
const DEFAULT_FLOATING_POSITION = { x: 24, y: 24 };

const contextByRoute: Array<{
  test: (pathname: string) => boolean;
  context: Omit<PageContext, 'title'> & { title?: string };
}> = [
  {
    test: (pathname) => pathname.includes('/program/device-health') || pathname === '/maintenance',
    context: {
      title: '设备健康',
      scope: '设备、健康分、故障预测、维修工单',
      intro: '我会基于当前设备维护页面提供帮助，可以解释风险、总结设备状态，也可以生成维修工单草稿。',
      quickPrompts: ['总结当前设备健康', '解释高风险设备', '生成维修工单草稿', '给出本周维护优先级'],
    },
  },
  {
    test: (pathname) => pathname.includes('/program/supply') || pathname.includes('/program/material') || pathname === '/supply-chain',
    context: {
      title: '供应链风险',
      scope: '供应商、库存、物料影响、采购建议',
      intro: '我会基于供应链页面提供帮助，可以总结供应风险、解释高风险供应商，也可以生成采购申请或物料申请草稿。',
      quickPrompts: ['总结供应风险', '生成采购申请草稿', '生成物料申请草稿', '给出替代供应商建议'],
    },
  },
  {
    test: (pathname) => pathname.includes('/program/quality') || pathname.includes('/program/defect') || pathname === '/quality',
    context: {
      title: '质量分析',
      scope: '缺陷、检验、SPC、CAPA、追溯',
      intro: '我会基于质量页面提供帮助，可以解释质量异常、追溯影响范围，也可以生成 CAPA 草稿。',
      quickPrompts: ['总结质量异常', '解释缺陷原因', '生成 CAPA 草稿', '追溯影响范围'],
    },
  },
  {
    test: (pathname) => pathname.includes('/program/production') || pathname.includes('/program/oee') || pathname === '/dashboard',
    context: {
      title: '生产态势',
      scope: 'OEE、产线、计划、产量、告警',
      intro: '我会基于生产页面提供帮助，可以解释 OEE、总结产线状态，也可以生成班次摘要。',
      quickPrompts: ['总结生产态势', '解释 OEE 下降原因', '生成班次摘要', '列出需要关注的产线'],
    },
  },
  {
    test: (pathname) => pathname.includes('/workflow'),
    context: {
      title: '流程中心',
      scope: '审批、待办、退回、流程状态',
      intro: '我会基于流程中心提供帮助，可以总结待办、解释审批状态，也可以生成处理意见草稿。',
      quickPrompts: ['总结我的待办', '生成审批意见', '解释退回原因', '列出超时流程'],
    },
  },
  {
    test: (pathname) => pathname.includes('/system-admin') || pathname.includes('/account-center'),
    context: {
      title: '平台管理',
      scope: '应用、菜单、权限、审计、AI 设置',
      intro: '我会基于平台管理页面提供帮助，可以解释配置、生成规则草稿，也可以总结审计线索。',
      quickPrompts: ['解释当前配置', '生成规则草稿', '总结 AI 调用日志', '给出权限检查建议'],
    },
  },
];

const nowText = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

function buildPageContext(pathname: string, fallbackTitle: string): PageContext {
  const matched = contextByRoute.find((item) => item.test(pathname));
  if (matched) {
    return {
      title: matched.context.title || fallbackTitle,
      scope: matched.context.scope,
      intro: matched.context.intro,
      quickPrompts: matched.context.quickPrompts,
    };
  }

  return {
    title: fallbackTitle || '当前页面',
    scope: '当前页面数据、操作和业务上下文',
    intro: '我在。你可以直接聊天，也可以问当前页面里的数据、流程或下一步建议。',
    quickPrompts: ['随便聊聊', '总结当前页面', '解释关键指标', '生成处理建议'],
  };
}

function createAssistantMessage(reply: AssistantReply | string, source?: string): ChatMessage {
  return {
    id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: 'assistant',
    content: typeof reply === 'string' ? reply : reply.content,
    actions: typeof reply === 'string' ? undefined : reply.actions,
    createdAt: nowText(),
    source,
  };
}

function createUserMessage(content: string): ChatMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: 'user',
    content,
    createdAt: nowText(),
  };
}

function formatActionValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '待补充';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function mapAgentActions(actions?: AgentSkillAction[]): MockSkillAction[] | undefined {
  if (!actions?.length) return undefined;
  return actions.map((action) => {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      id: `${action.skill || 'agent-action'}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      skill: action.skill || 'agent.action',
      title: action.title || '待确认动作',
      status: 'ready_for_review',
      summary: action.requires_confirmation
        ? '该动作需要你确认后才会写入或提交。'
        : '这是 Agent 基于当前上下文生成的建议动作。',
      fields: Object.entries(payload).slice(0, 6).map(([label, value]) => ({
        label,
        value: formatActionValue(value),
      })),
      nextSteps: action.requires_confirmation
        ? ['复核字段和证据', '确认后再保存草稿或提交流程']
        : ['按需继续追问或调整建议'],
    };
  });
}

function getAgentResponseSource(payload: AgentChatResponse): string {
  const answerStep = [...(payload.steps || [])].reverse().find((step) => step.type === 'respond');
  const modelConfigStep = [...(payload.steps || [])].reverse().find((step) => step.id === 'step-model-config');
  const provider = typeof answerStep?.provider === 'string' ? answerStep.provider : '';
  const model = typeof answerStep?.model === 'string' ? answerStep.model : '';
  const fallbackReason = typeof answerStep?.fallback_reason === 'string' ? answerStep.fallback_reason : '';

  if (modelConfigStep?.status === 'blocked') {
    return '未配置大模型';
  }
  if (provider || (model && model !== 'local-agent-runtime')) {
    return [provider && `provider: ${provider}`, model && `model: ${model}`].filter(Boolean).join(' / ');
  }
  if (fallbackReason) {
    return fallbackReason.includes('not configured') ? '未配置大模型' : '大模型连接失败';
  }
  if (payload.actions?.length) {
    return 'backend Agent: draft action generated';
  }
  return 'backend Agent';
}

function generateUnavailableReply(): AssistantReply {
  return {
    content: '当前无法连接后端 AI 服务。请先确认后端服务、登录状态和大模型配置可用后再试。',
  };
}

function getStatusLabel(status: MockSkillStatus) {
  return status === 'draft_created' ? '草稿已生成' : '待复核';
}

export default function AiChatWidget({ pageTitle, applicationName }: AiChatWidgetProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [tenantProfile, setTenantProfile] = useState<PublicTenantProfile>(DEFAULT_PUBLIC_TENANT_PROFILE);
  const [floatingPosition, setFloatingPosition] = useState(DEFAULT_FLOATING_POSITION);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; dragging: boolean } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const assistantDisplayName = tenantProfile.assistantName || `${tenantProfile.productName} AI`;

  const pageContext = useMemo(
    () => buildPageContext(location.pathname, pageTitle),
    [location.pathname, pageTitle],
  );

  const storageKey = `${STORAGE_PREFIX}${location.pathname}`;

  useEffect(() => {
    let active = true;
    getPublicTenantProfile().then((profile) => {
      if (active) setTenantProfile(profile);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { x: number; y: number };
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        setFloatingPosition({
          x: Math.max(12, Math.min(parsed.x, window.innerWidth - 96)),
          y: Math.max(12, Math.min(parsed.y, window.innerHeight - 72)),
        });
      }
    } catch {
      localStorage.removeItem(POSITION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMessage[];
        setMessages(parsed);
        return;
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    setMessages([createAssistantMessage(pageContext.intro)]);
  }, [pageContext.intro, storageKey]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const persistMessages = (next: ChatMessage[]) => {
    setMessages(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    const userMessage = createUserMessage(trimmed);
    const pending = [...messages, userMessage];
    persistMessages(pending);
    setInput('');
    setSending(true);
    try {
      const response = await sendAgentChat({
        message: trimmed,
        page: location.pathname,
        context: {
          pageTitle: pageContext.title,
          scope: pageContext.scope,
          applicationName,
          route: location.pathname,
        },
      });
      const payload = (response.data ?? {}) as AgentChatResponse;
      const assistantMessage = createAssistantMessage({
        content: payload.answer || '我已收到你的问题，但后端没有返回可展示的回答。',
        actions: mapAgentActions(payload.actions),
      }, getAgentResponseSource(payload));
      persistMessages([...pending, assistantMessage]);
    } catch {
      persistMessages([...pending, createAssistantMessage(generateUnavailableReply(), '无法连接后端 AI 服务')]);
    } finally {
      setSending(false);
    }
  };

  const startNewSession = () => {
    const next = [createAssistantMessage(pageContext.intro)];
    persistMessages(next);
    setInput('');
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: floatingPosition.x,
      originY: floatingPosition.y,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragFloatingButton = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.dragging = true;
    if (!drag.dragging) return;
    setFloatingPosition({
      x: Math.max(12, Math.min(drag.originX - deltaX, window.innerWidth - 96)),
      y: Math.max(12, Math.min(drag.originY - deltaY, window.innerHeight - 72)),
    });
  };

  const stopDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(floatingPosition));
    window.setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };

  const toggleOpen = () => {
    if (dragRef.current?.dragging) return;
    setOpen((prev) => !prev);
  };

  return (
    <>
      <Button
        className="ai-floating-button"
        type="primary"
        style={{ right: floatingPosition.x, bottom: floatingPosition.y }}
        onPointerDown={startDrag}
        onPointerMove={dragFloatingButton}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClick={toggleOpen}
        aria-label="AI Assistant"
      >
        <RobotOutlined />
        <span>AI</span>
      </Button>

      {open && (
        <section
          className="ai-chat-panel"
          style={{ right: floatingPosition.x, bottom: floatingPosition.y + 64 }}
          aria-label="AI chat panel"
        >
          <header className="ai-chat-header">
            <div>
              <Space size={8} align="center">
                <RobotOutlined />
                <Typography.Text strong>{assistantDisplayName}</Typography.Text>
              </Space>
              <Typography.Text type="secondary">
                基于当前页面：{pageContext.title}
              </Typography.Text>
            </div>
            <Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />
          </header>

          <div className="ai-chat-context">
            <Tag color="blue">{applicationName || '当前应用'}</Tag>
            <span>{pageContext.scope}</span>
          </div>

          <div className="ai-chat-body" ref={bodyRef}>
            {messages.map((message) => (
              <div className={`ai-chat-message ${message.role}`} key={message.id}>
                <div className="ai-chat-bubble">
                  <Typography.Text>{message.content}</Typography.Text>
                  {message.role === 'assistant' && message.source ? (
                    <span className="ai-chat-source">{message.source}</span>
                  ) : null}
                  {message.actions?.length ? (
                    <div className="ai-skill-action-list">
                      {message.actions.map((action) => (
                        <article className="ai-skill-action-card" key={action.id}>
                          <div className="ai-skill-action-head">
                            <span className="ai-skill-action-icon">
                              <CodeOutlined />
                            </span>
                            <div>
                              <Typography.Text strong>{action.title}</Typography.Text>
                              <code>{action.skill}</code>
                            </div>
                            <Tag color="green" icon={<CheckCircleOutlined />}>
                              {getStatusLabel(action.status)}
                            </Tag>
                          </div>
                          <Typography.Paragraph className="ai-skill-action-summary">
                            {action.summary}
                          </Typography.Paragraph>
                          <dl className="ai-skill-action-fields">
                            {action.fields.map((field) => (
                              <div key={`${action.id}-${field.label}`}>
                                <dt>{field.label}</dt>
                                <dd>{field.value}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="ai-skill-action-next">
                            <Typography.Text type="secondary">后续动作</Typography.Text>
                            <ol>
                              {action.nextSteps.map((step) => (
                                <li key={`${action.id}-${step}`}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span>{message.createdAt}</span>
              </div>
            ))}
            {sending ? (
              <div className="ai-chat-message assistant">
                <div className="ai-chat-bubble">
                  <Typography.Text type="secondary">正在连接 AI Agent...</Typography.Text>
                </div>
                <span>{nowText()}</span>
              </div>
            ) : null}
          </div>

          <div className="ai-chat-quick-prompts">
            {pageContext.quickPrompts.map((prompt) => (
              <Button key={prompt} size="small" disabled={sending} onClick={() => { void sendMessage(prompt); }}>
                {prompt}
              </Button>
            ))}
          </div>

          <div className="ai-chat-input">
            <Input.TextArea
              value={input}
              placeholder="问我当前页面的问题，或让我生成草稿..."
              autoSize={{ minRows: 1, maxRows: 3 }}
              disabled={sending}
              onChange={(event) => setInput(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
            />
            <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={() => { void sendMessage(input); }} />
          </div>

          <footer className="ai-chat-footer">
            <Button size="small" icon={<FileTextOutlined />} onClick={startNewSession}>
              新会话
            </Button>
            <Button size="small" icon={<DeleteOutlined />} onClick={startNewSession}>
              清空当前页历史
            </Button>
          </footer>
        </section>
      )}
    </>
  );
}
