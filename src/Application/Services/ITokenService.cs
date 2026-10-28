using CoopIS.Domain.Entities;

namespace CoopIS.Application.Services;

public interface ITokenService
{
    string GenerateJwtToken(UserAccount user);
}
