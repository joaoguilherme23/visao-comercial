from app.models.user import User, UserTenant, UserRole
from app.models.tenant import Cliente, TenantConnection
from app.models.lead import Lead
from app.models.message import Mensagem
from app.models.grupo import Grupo, GrupoMensagem
from app.models.analysis import Analise
from app.models.numero import NumeroBot
from app.models.nicho import NichoConfig
from app.models.dashboard import KpiCatalogo, DashboardConfig, AnaliseWidget
from app.models.llm_log import LlmUsageLog
from app.models.comentario import ComentarioLead
from app.models.tenant_nicho_config import TenantNichoConfig
from app.models.oidc import OidcApplicationSession, OidcIdentityLink, OidcLoginTransaction
from app.models.analysis_job import AnalysisJob
