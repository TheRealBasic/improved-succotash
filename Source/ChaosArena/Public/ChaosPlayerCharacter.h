#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "ChaosPlayerCharacter.generated.h"

class UCameraComponent;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;

/**
 * First-person playable character using Enhanced Input.
 */
UCLASS(Blueprintable, BlueprintType)
class AChaosPlayerCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AChaosPlayerCharacter();

    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent) override;

    /** Camera used for first-person view. */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
    UCameraComponent* FirstPersonCamera;

    /** Input mapping context assigned at begin play for locally controlled characters. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    UInputMappingContext* IMC_ChaosPlayer;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    UInputAction* IA_Move;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    UInputAction* IA_Look;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    UInputAction* IA_Jump;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    UInputAction* IA_Sprint;

    /** Base walking speed (non-sprinting). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement")
    float WalkSpeed;

    /** Speed while sprinting. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement")
    float SprintSpeed;

    /** Enable sprint on the owning client and notify the server. */
    void StartSprinting();

    /** Disable sprint on the owning client and notify the server. */
    void StopSprinting();

protected:
    /**
     * Move the character using a 2D input axis (X = Right/Left, Y = Forward/Backward).
     */
    void Move(const FInputActionValue& Value);

    /**
     * Look around using mouse/controller input (X = Yaw, Y = Pitch).
     */
    void Look(const FInputActionValue& Value);

    /** Sets movement speed based on current sprint state on both client and server. */
    void ApplySprintingSpeed(bool bIsSprinting);

    /** Server RPC to propagate sprint state to authority. */
    UFUNCTION(Server, Reliable)
    void ServerSetSprinting(bool bIsSprinting);
};

