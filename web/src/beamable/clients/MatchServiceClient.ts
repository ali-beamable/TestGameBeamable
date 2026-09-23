/**
 * ⚠️ THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
 * All manual edits will be lost when this file is regenerated.
 */

import { BeamMicroServiceClient, type BeamBase } from '@beamable/sdk';
import type * as Types from './types';

declare module '@beamable/sdk' {
  interface BeamBase {
    /**
     * Access the MatchService microservice.
     * @remarks Before accessing this property, register it first via the `use` method.
     * @example
     * ```ts
     * // client-side:
     * beam.use(MatchServiceClient);
     * beam.matchServiceClient.serviceName;
     * // server-side:
     * beamServer.use(MatchServiceClient);
     * beamServer.matchServiceClient.serviceName;
     * ```
     */
    matchServiceClient: MatchServiceClient;
  }
}

export class MatchServiceClient extends BeamMicroServiceClient {
  constructor(
    beam: BeamBase
  ) {
    super(beam);
  }
  
  get serviceName(): string {
    return "MatchService";
  }
  
  async startMatch(): Promise<Types.MatchView> {
    return this.request({
      endpoint: "StartMatch",
      withAuth: true
    });
  }
  
  async playRound(params: Types.PlayRoundRequestArgs): Promise<Types.RoundResult> {
    return this.request({
      endpoint: "PlayRound",
      payload: params,
      withAuth: true
    });
  }
  
  async forfeit(params: Types.ForfeitRequestArgs): Promise<Types.MatchView> {
    return this.request({
      endpoint: "Forfeit",
      payload: params,
      withAuth: true
    });
  }
  
  async getMyHistory(params: Types.GetMyHistoryRequestArgs): Promise<Types.MatchHistory> {
    return this.request({
      endpoint: "GetMyHistory",
      payload: params,
      withAuth: true
    });
  }
}
