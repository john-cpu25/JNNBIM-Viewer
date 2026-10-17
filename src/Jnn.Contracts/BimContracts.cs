namespace Jnn.Contracts;

public record BridgeMessage<T>(string Action, T Payload);

public record BimElementDto(
    string ElementId,
    string GlobalId,
    string Name,
    string Category,
    string Discipline,
    string Storey,
    string Material,
    float NetVolume,
    float FormworkArea
);

public record ClashResultDto(
    string ClashId,
    string Status,
    string Severity,
    string ElementAId,
    string ElementBId,
    float OverlapDistance,
    string GridLocation,
    string AssignedTo
);

public record QuantitySummaryDto(
    string Storey,
    string Category,
    float TotalNetVolume,
    float TotalFormworkArea,
    int ElementCount
);
