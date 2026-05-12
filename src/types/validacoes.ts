/**
 * Tipos relacionados às validações de grade horária
 * @module types/validacoes
 */

/**
 * Nível de gravidade da validação
 * - IMPEditivo: Problema crítico que deve ser corrigido prioritariamente
 * - ALERTA: Problema que pode ser ignorado temporariamente, mas requer atenção
 */
export type GravidadeValidacao = "IMPEDITIVO" | "ALERTA";

/**
 * Códigos das regras de validação implementadas
 */
export type TipoValidacao =
  | "CHOQUE_TURMA" // 1. Turma com duas aulas no mesmo dia/horário
  | "CHOQUE_ESPACO" // 2. Espaço ocupado por duas aulas no mesmo dia/horário
  | "CHOQUE_DOCENTE" // 3. Professor com duas aulas no mesmo dia/horário
  | "DESCANSO_DOCENTE" // 4. Professor sem descanso adequado entre dias consecutivos
  | "LIMITE_TURNOS" // 5. Professor excede limite de turnos no mesmo dia
  | "DIA_PLANEJAMENTO" // 6. Professor tem aula no seu dia de planejamento
  | "AULAS_GEMINADAS" // 7. Turma com mais de 2 aulas da mesma disciplina no dia
  | "CARGA_HORARIA" // 8. Disciplina não atingiu carga horária semanal
  | "FIM_DE_SEMANA" // 9. Professor tem aula sexta à noite e segunda manhã
  | "CUSTOM"; // Para regras personalizadas futuras

/**
 * Estrutura de um registro de validação
 */
export interface ValidacaoLog {
  id?: number;
  aula_id: number;
  tipo: TipoValidacao;
  gravidade: GravidadeValidacao;
  mensagem: string;
  detalhes?: Record<string, any>;
  criado_em?: Date;
}

/**
 * Resultado do processo de validação de uma aula
 */
export interface ResultadoValidacao {
  sucesso: boolean;
  aula_id?: number;
  validacoes: ValidacaoLog[];
  resumo: {
    impeditivos: number;
    alertas: number;
  };
}

/**
 * Dados necessários para executar as validações
 */
export interface DadosValidacao {
  aula_id: number;
  turma_id: number;
  professor_id: number;
  espaco_id: number | null;
  slot_horario_id: number;
  dia_semana: string;
  disciplina_id: number;
  versao_id: number;
}
