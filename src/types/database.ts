export type DiaSemana =
  | "SEGUNDA"
  | "TERCA"
  | "QUARTA"
  | "QUINTA"
  | "SEXTA"
  | "SABADO"
  | "DOMINGO";
export type StatusAula = "ATIVO" | "CANCELADO" | "PENDENTE";
export type GravidadeValidacao = "IMPEDITIVO" | "ALERTA";

export interface Curso {
  id: number;
  nome: string;
  codigo: string;
  nivel: string;
  created_at: string;
}

export interface Professor {
  id: number;
  nome: string;
  email: string | null;
  created_at: string;
}

export interface Disciplina {
  id: number;
  nome: string;
  curso_id: number;
  carga_horaria: number | null;
  created_at: string;
}

export interface Turma {
  id: number;
  codigo: string;
  curso_id: number;
  ano_letivo: number;
  created_at: string;
}

export interface Espaco {
  id: number;
  nome: string;
  tipo: string | null;
  capacidade: number | null;
  created_at: string;
}

export interface SlotHorario {
  id: number;
  hora_inicio: string; // Time
  hora_fim: string; // Time
  descricao: string | null;
}

export interface VersaoGrade {
  id: number;
  semestre: string;
  descricao: string | null;
  ativa: boolean;
  created_at: string;
}

export interface Aula {
  id: number;
  turma_id: number;
  disciplina_id: number;
  professor_id: number;
  espaco_id: number | null;
  slot_horario_id: number;
  dia_semana: DiaSemana;
  versao_id: number;
  status: StatusAula;
  created_at: string;
  updated_at: string;
}

export interface ValidacaoLog {
  id: number;
  aula_id: number;
  regra_codigo: string;
  gravidade: GravidadeValidacao;
  mensagem: string;
  dados_conflito: Record<string, any> | null;
  criado_em: string;
}

export interface GradeHorariaItem {
  aula_id: number;
  turma_id: number;
  turma_codigo: string;
  curso_id: number;
  curso_nome: string;
  disciplina_id: number;
  disciplina_nome: string;
  professor_id: number;
  professor_nome: string;
  espaco_id: number | null;
  espaco_nome: string | null;
  slot_id: number;
  hora_inicio: string;
  hora_fim: string;
  dia_semana: DiaSemana;
  status: StatusAula;
  versao_semestre: string;
}

export interface Database {
  public: {
    Tables: {
      cursos: { Row: Curso };
      professores: { Row: Professor };
      disciplinas: { Row: Disciplina };
      turmas: { Row: Turma };
      espacos: { Row: Espaco };
      slots_horarios: { Row: SlotHorario };
      versoes_grade: { Row: VersaoGrade };
      aulas: { Row: Aula };
      validacoes_logs: { Row: ValidacaoLog };
    };
    Views: {
      mv_grade_horaria_completa: { Row: GradeHorariaItem };
    };
  };
}
