export type TrainerLevel = 'start' | 'pro';
export const TRAINER_LEVELS: Readonly<Record<TrainerLevel,{name:string;rank:number;title:string;audience:string;description:string;criteria:string}>>;
export function isTrainerLevel(value:unknown):value is TrainerLevel;
